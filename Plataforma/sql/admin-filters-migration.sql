-- ============================================================
-- ADMIN CONTENT FILTERS MIGRATION
-- Table to let admins toggle content filters on/off via UI
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE content_filters (
  id text PRIMARY KEY,
  label text NOT NULL,
  pattern text NOT NULL,
  filter_type text NOT NULL,
  enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_filters ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for client-side filter to load state)
CREATE POLICY "Anyone can read filters" ON content_filters
  FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "Admins can update filters" ON content_filters
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed with the 5 existing filters
INSERT INTO content_filters (id, label, pattern, filter_type, enabled) VALUES
  ('phone', 'Numero de telefone', '\d{2,3}[\s.\-]?\d{4,5}[\s.\-]?\d{4}', 'numero de telefone', true),
  ('email', 'Endereco de email', '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', 'endereco de email', true),
  ('link', 'Links (URLs)', '(https?:\/\/|www\.)\S+', 'link', true),
  ('social_profile', 'Perfil de rede social (@)', '@[a-zA-Z0-9_]{3,}', 'perfil de rede social', true),
  ('social_contact', 'Contato de rede social', '(?:whatsapp|wpp|zap|zapzap|instagram|insta|tiktok|telegram)\s*[:.]?\s*\d[\d\s.\-]{6,}', 'contato de rede social', true);
