-- ============================================================
-- AcolheBem — Fix topics seed: gender-specific topics matching data.js
-- Run this in Supabase SQL Editor (after topics-migration.sql)
-- ============================================================

-- 1. Delete old generic seed topics
DELETE FROM topics WHERE is_default = true;

-- 2. Fix RLS: allow default topics to be inserted without auth (for seed)
-- Also allow anonymous insert for auto-created topics from the app
DROP POLICY IF EXISTS "topics_insert" ON topics;
CREATE POLICY "topics_insert" ON topics
  FOR INSERT WITH CHECK (true);

-- 3. Insert gender-specific topics matching data.js slugify pattern: slugify(title) + '-' + gender

-- WOMEN topics (5)
INSERT INTO topics (name, slug, emoji, description, color, is_default) VALUES
  ('Ansiedade e Sobrecarga Emocional', 'ansiedade-e-sobrecarga-emocional-women', '🧠', 'Grupo para quem sente o peso do mundo nos ombros', '#7c3aed', true),
  ('Relacionamentos e Autoestima', 'relacionamentos-e-autoestima-women', '💕', 'Aprenda a se amar e construir relações saudáveis', '#ec4899', true),
  ('Corpo, Alimentação e Imagem', 'corpo-alimentacao-e-imagem-women', '🪞', 'Reconecte-se com seu corpo de forma gentil', '#f43f5e', true),
  ('Maternidade e Vida Familiar', 'maternidade-e-vida-familiar-women', '👶', 'Ser mãe é lindo, mas também pode ser difícil', '#f59e0b', true),
  ('Violência e Traumas', 'violencia-e-traumas-women', '🛡️', 'Você não está sozinha. Aqui é um espaço seguro', '#ef4444', true);

-- MEN topics (5)
INSERT INTO topics (name, slug, emoji, description, color, is_default) VALUES
  ('Pressão Financeira e Profissional', 'pressao-financeira-e-profissional-men', '💼', 'O peso de ser provedor não precisa ser carregado sozinho', '#3b82f6', true),
  ('Dificuldade em Expressar Emoções', 'dificuldade-em-expressar-emocoes-men', '🎭', 'Sentir é humano. Expressar é libertador', '#14b8a6', true),
  ('Vícios e Comportamentos Compulsivos', 'vicios-e-comportamentos-compulsivos-men', '⛓️', 'Reconhecer é o primeiro passo para a liberdade', '#f59e0b', true),
  ('Relacionamentos e Paternidade', 'relacionamentos-e-paternidade-men', '👨‍👧', 'Ser presente é a maior força que existe', '#6366f1', true),
  ('Identidade e Propósito', 'identidade-e-proposito-men', '🧭', 'Encontre quem você realmente é, além das expectativas', '#10b981', true);
