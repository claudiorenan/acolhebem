-- P1.2: Busca Full-Text com suporte a acentos
-- Habilita extensoes, cria indices GIN e funcoes RPC de busca

-- 1. Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Funcao imutavel para unaccent (necessaria para indices)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- 3. Indices GIN para busca por trigramas (suporta ILIKE e similarity)
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
  ON public.posts USING gin (immutable_unaccent(content) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING gin (immutable_unaccent(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_topics_name_trgm
  ON public.topics USING gin (immutable_unaccent(name) gin_trgm_ops);

-- 4. RPC: search_posts
-- Busca posts por conteudo, retorna com autor e topico
CREATE OR REPLACE FUNCTION public.search_posts(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  is_anonymous boolean,
  topic_id uuid,
  user_id uuid,
  author_name text,
  author_photo text,
  author_is_psi boolean,
  topic_name text,
  topic_emoji text,
  relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
BEGIN
  v_query := immutable_unaccent(lower(trim(p_query)));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.created_at,
    p.is_anonymous,
    p.topic_id,
    p.user_id,
    CASE WHEN p.is_anonymous THEN 'Anonimo'::text ELSE pr.name END AS author_name,
    CASE WHEN p.is_anonymous THEN NULL::text ELSE pr.photo_url END AS author_photo,
    COALESCE(pr.is_psi, false) AS author_is_psi,
    t.name AS topic_name,
    t.emoji AS topic_emoji,
    similarity(immutable_unaccent(lower(p.content)), v_query) AS relevance
  FROM posts p
  LEFT JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN topics t ON t.id = p.topic_id
  WHERE p.status = 'visible'
    AND immutable_unaccent(lower(p.content)) ILIKE '%' || v_query || '%'
  ORDER BY relevance DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. RPC: search_profiles
-- Busca perfis por nome ou bio
CREATE OR REPLACE FUNCTION public.search_profiles(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  photo_url text,
  bio text,
  city text,
  is_psi boolean,
  relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
BEGIN
  v_query := immutable_unaccent(lower(trim(p_query)));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.name,
    pr.photo_url,
    pr.bio,
    pr.city,
    COALESCE(pr.is_psi, false) AS is_psi,
    GREATEST(
      similarity(immutable_unaccent(lower(pr.name)), v_query),
      similarity(immutable_unaccent(lower(COALESCE(pr.bio, ''))), v_query) * 0.5
    ) AS relevance
  FROM profiles pr
  WHERE immutable_unaccent(lower(pr.name)) ILIKE '%' || v_query || '%'
     OR immutable_unaccent(lower(COALESCE(pr.bio, ''))) ILIKE '%' || v_query || '%'
  ORDER BY relevance DESC, pr.name ASC
  LIMIT p_limit;
END;
$$;

-- 6. RPC: search_topics
-- Busca topicos por nome ou descricao
CREATE OR REPLACE FUNCTION public.search_topics(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  emoji text,
  description text,
  post_count int,
  relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
BEGIN
  v_query := immutable_unaccent(lower(trim(p_query)));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.emoji,
    t.description,
    t.post_count,
    GREATEST(
      similarity(immutable_unaccent(lower(t.name)), v_query),
      similarity(immutable_unaccent(lower(COALESCE(t.description, ''))), v_query) * 0.5
    ) AS relevance
  FROM topics t
  WHERE immutable_unaccent(lower(t.name)) ILIKE '%' || v_query || '%'
     OR immutable_unaccent(lower(COALESCE(t.description, ''))) ILIKE '%' || v_query || '%'
  ORDER BY relevance DESC, t.post_count DESC
  LIMIT p_limit;
END;
$$;

-- 7. Permissoes
GRANT EXECUTE ON FUNCTION public.search_posts(text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_topics(text, int) TO anon, authenticated;
