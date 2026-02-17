-- ============================================================
-- AcolheBem — Topics Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create topics table
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '💬',
  description TEXT,
  color TEXT DEFAULT '#2f6f64',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ALTER posts: add topic_id and is_anonymous
ALTER TABLE posts ADD COLUMN topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN is_anonymous BOOLEAN DEFAULT false;

-- 3. ALTER profiles: add gender and birth_year
ALTER TABLE profiles ADD COLUMN gender TEXT CHECK (gender IN ('female','male','other','prefer_not_to_say'));
ALTER TABLE profiles ADD COLUMN birth_year INT CHECK (birth_year >= 1920 AND birth_year <= 2015);

-- 4. ALTER replies: add is_anonymous
ALTER TABLE replies ADD COLUMN is_anonymous BOOLEAN DEFAULT false;

-- 5. Trigger to update topic post_count
CREATE OR REPLACE FUNCTION update_topic_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.topic_id IS NOT NULL THEN
    UPDATE topics SET post_count = post_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' AND OLD.topic_id IS NOT NULL THEN
    UPDATE topics SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.topic_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_posts_topic_count
  AFTER INSERT OR DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_topic_post_count();

-- 6. Update handle_new_user trigger to include gender and birth_year
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, whatsapp, city, state, bio, gender, birth_year)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'bio',
    NEW.raw_user_meta_data->>'gender',
    (NEW.raw_user_meta_data->>'birth_year')::INT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS for topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Anyone can read topics
CREATE POLICY "topics_select" ON topics
  FOR SELECT USING (true);

-- Authenticated users can create topics
CREATE POLICY "topics_insert" ON topics
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Owner can update non-default topics
CREATE POLICY "topics_update" ON topics
  FOR UPDATE USING (auth.uid() = created_by AND is_default = false);

-- 8. Seed default topics
INSERT INTO topics (name, slug, emoji, description, color, is_default) VALUES
  ('Ansiedade', 'ansiedade', '😰', 'Medos, preocupações e crises de ansiedade', '#e57373', true),
  ('Relacionamentos', 'relacionamentos', '💑', 'Amor, amizade e conflitos interpessoais', '#f06292', true),
  ('Autoestima', 'autoestima', '🪞', 'Autoimagem, confiança e aceitação pessoal', '#ba68c8', true),
  ('Família', 'familia', '👨‍👩‍👧‍👦', 'Dinâmicas familiares e conflitos em casa', '#4fc3f7', true),
  ('Traumas', 'traumas', '🩹', 'Experiências dolorosas e processos de cura', '#7986cb', true),
  ('Trabalho e Finanças', 'trabalho-financas', '💼', 'Estresse profissional e preocupações financeiras', '#ffb74d', true),
  ('Emoções', 'emocoes', '🌊', 'Tristeza, raiva, solidão e outras emoções', '#4dd0e1', true),
  ('Vícios', 'vicios', '🔗', 'Dependências, compulsões e processos de recuperação', '#a1887f', true),
  ('Identidade e Propósito', 'identidade-proposito', '🧭', 'Quem sou eu? Para onde vou?', '#9575cd', true),
  ('Corpo e Alimentação', 'corpo-alimentacao', '🍃', 'Relação com o corpo, alimentação e saúde', '#81c784', true),
  ('Geral', 'geral', '💬', 'Conversas livres sobre qualquer tema', '#2f6f64', true);
