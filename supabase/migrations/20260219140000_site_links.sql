-- =============================================
-- SITE LINKS — Botões editáveis da comunidade
-- =============================================

CREATE TABLE IF NOT EXISTS site_links (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'link',
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE site_links ENABLE ROW LEVEL SECURITY;

-- SELECT público (qualquer visitante pode ver)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'site_links_select_public') THEN
        CREATE POLICY "site_links_select_public"
            ON site_links FOR SELECT
            USING (true);
    END IF;
END $$;

-- UPDATE/INSERT/DELETE apenas admins
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'site_links_admin_modify') THEN
        CREATE POLICY "site_links_admin_modify"
            ON site_links FOR ALL
            USING (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
            )
            WITH CHECK (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
            );
    END IF;
END $$;

-- Seed data
INSERT INTO site_links (id, label, url, icon, enabled, sort_order) VALUES
    ('ugc',       'Sou criador de conteúdo', 'https://ugc.cademeupsi.com.br/cadastro/influenciado', 'video',     true, 1),
    ('instagram', 'Seguir no Instagram',     'https://instagram.com/cademeupsi',                     'instagram', true, 2),
    ('youtube',   'Canal no YouTube',        'https://youtube.com/@cademeupsi',                      'youtube',   true, 3)
ON CONFLICT (id) DO NOTHING;
