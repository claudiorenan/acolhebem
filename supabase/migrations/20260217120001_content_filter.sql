-- ============================================================
-- CONTENT FILTER MIGRATION
-- Server-side trigger to block contact info in posts and replies
-- ============================================================

CREATE OR REPLACE FUNCTION check_content_contact_info()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  content_text := NEW.content;

  -- Skip check for empty content
  IF content_text IS NULL OR content_text = '' THEN
    RETURN NEW;
  END IF;

  -- Block phone numbers (Brazilian format: DDD + 8-9 digits)
  IF content_text ~ '\d{2,3}[\s.\-]?\d{4,5}[\s.\-]?\d{4}' THEN
    RAISE EXCEPTION 'Conteudo bloqueado: nao e permitido compartilhar numeros de telefone.';
  END IF;

  -- Block email addresses
  IF content_text ~ '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}' THEN
    RAISE EXCEPTION 'Conteudo bloqueado: nao e permitido compartilhar enderecos de email.';
  END IF;

  -- Block URLs (http/https/www)
  IF content_text ~ '(https?://|www\.)\S+' THEN
    RAISE EXCEPTION 'Conteudo bloqueado: nao e permitido compartilhar links.';
  END IF;

  -- Block @ handles (social media)
  IF content_text ~ '@[a-zA-Z0-9_]{3,}' THEN
    RAISE EXCEPTION 'Conteudo bloqueado: nao e permitido compartilhar perfis de redes sociais.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to posts
DROP TRIGGER IF EXISTS check_posts_contact_info ON posts;
CREATE TRIGGER check_posts_contact_info
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION check_content_contact_info();

-- Apply to replies
DROP TRIGGER IF EXISTS check_replies_contact_info ON replies;
CREATE TRIGGER check_replies_contact_info
  BEFORE INSERT OR UPDATE ON replies
  FOR EACH ROW
  EXECUTE FUNCTION check_content_contact_info();
