-- ============================================================
-- AcolheBem — Engagement & Admin Features Migration
-- Covers: reports, referrals, announcements, reaction types,
--         streaks, onboarding, badges, featured posts,
--         weekly digest, ban system, dashboard RPCs, feature flags
-- ============================================================

-- ============================================================
-- 1. BAN SYSTEM — add banned_at and ban_reason to profiles
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- ============================================================
-- 2. REPORTS (Denúncias)
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply', 'profile')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    admin_action TEXT DEFAULT NULL,
    admin_notes TEXT DEFAULT NULL,
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view own reports" ON reports
    FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports" ON reports
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can update reports" ON reports
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ============================================================
-- 3. ANNOUNCEMENTS (Avisos do Admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    body TEXT CHECK (char_length(body) <= 1000),
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'event', 'celebration')),
    active BOOLEAN NOT NULL DEFAULT true,
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_announcements_active ON announcements(active, created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements" ON announcements
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ============================================================
-- 4. REACTION TYPES (extend reactions table)
-- ============================================================

-- Add reaction_type column (default 'like' for backwards compat)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reactions' AND column_name = 'reaction_type'
    ) THEN
        ALTER TABLE reactions ADD COLUMN reaction_type TEXT NOT NULL DEFAULT 'like'
            CHECK (reaction_type IN ('like', 'hug', 'strength', 'welcome', 'thanks'));
    END IF;
END $$;

-- Drop old unique constraint and create new one with reaction_type
-- (allows same user to give different reaction types to same post)
DO $$
BEGIN
    -- Try to drop existing constraint (name may vary)
    BEGIN
        ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_post_id_user_id_key;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE reactions DROP CONSTRAINT IF EXISTS unique_reaction;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    -- Create new unique constraint including reaction_type
    ALTER TABLE reactions ADD CONSTRAINT reactions_post_user_type_unique
        UNIQUE (post_id, user_id, reaction_type);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. STREAKS (Daily check-in)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_streaks (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_check_in DATE,
    total_check_ins INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak" ON user_streaks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own streak" ON user_streaks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own streak" ON user_streaks
    FOR UPDATE USING (user_id = auth.uid());

-- RPC: record daily check-in and return streak info
CREATE OR REPLACE FUNCTION record_check_in()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := CURRENT_DATE;
    v_row user_streaks%ROWTYPE;
    v_new_streak INT;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_row FROM user_streaks WHERE user_id = v_uid;

    IF v_row IS NULL THEN
        -- First check-in ever
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_check_in, total_check_ins)
        VALUES (v_uid, 1, 1, v_today, 1);
        RETURN json_build_object('current_streak', 1, 'longest_streak', 1, 'total_check_ins', 1, 'is_new', true);
    END IF;

    IF v_row.last_check_in = v_today THEN
        -- Already checked in today
        RETURN json_build_object('current_streak', v_row.current_streak, 'longest_streak', v_row.longest_streak, 'total_check_ins', v_row.total_check_ins, 'is_new', false);
    END IF;

    IF v_row.last_check_in = v_today - 1 THEN
        v_new_streak := v_row.current_streak + 1;
    ELSE
        v_new_streak := 1; -- streak broken
    END IF;

    UPDATE user_streaks SET
        current_streak = v_new_streak,
        longest_streak = GREATEST(v_row.longest_streak, v_new_streak),
        last_check_in = v_today,
        total_check_ins = v_row.total_check_ins + 1,
        updated_at = now()
    WHERE user_id = v_uid;

    RETURN json_build_object(
        'current_streak', v_new_streak,
        'longest_streak', GREATEST(v_row.longest_streak, v_new_streak),
        'total_check_ins', v_row.total_check_ins + 1,
        'is_new', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION record_check_in() TO authenticated;

-- ============================================================
-- 6. BADGES / ACHIEVEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS badge_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'activity',
    threshold INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read badge definitions" ON badge_definitions
    FOR SELECT USING (true);

CREATE POLICY "Users can view own badges" ON user_badges
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all badges" ON user_badges
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "System can insert badges" ON user_badges
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Seed badge definitions
INSERT INTO badge_definitions (id, name, description, icon, category, threshold) VALUES
    ('first_post', 'Primeira Voz', 'Fez seu primeiro post', '🎤', 'milestone', 1),
    ('10_posts', 'Voz Ativa', 'Fez 10 posts', '📢', 'milestone', 10),
    ('first_reply', 'Acolhedor(a)', 'Respondeu seu primeiro post', '💬', 'milestone', 1),
    ('10_replies', 'Mão Amiga', 'Respondeu 10 posts', '🤝', 'milestone', 10),
    ('50_replies', 'Pilar da Comunidade', 'Respondeu 50 posts', '🏛️', 'milestone', 50),
    ('7_day_streak', 'Presença Fiel', '7 dias seguidos na comunidade', '🔥', 'streak', 7),
    ('30_day_streak', 'Compromisso Real', '30 dias seguidos na comunidade', '⭐', 'streak', 30),
    ('first_follow', 'Conexão', 'Seguiu alguém pela primeira vez', '🔗', 'social', 1),
    ('5_followers', 'Inspiração', '5 pessoas te seguem', '✨', 'social', 5),
    ('referral_1', 'Embaixador(a)', 'Indicou 1 pessoa para a comunidade', '🎯', 'referral', 1),
    ('referral_5', 'Multiplicador(a)', 'Indicou 5 pessoas', '🌟', 'referral', 5),
    ('onboarding_done', 'Bem-vindo(a)', 'Completou o onboarding', '🎉', 'onboarding', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. FEATURED POSTS (Post da Semana)
-- ============================================================

CREATE TABLE IF NOT EXISTS featured_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    featured_by UUID NOT NULL REFERENCES profiles(id),
    label TEXT NOT NULL DEFAULT 'Post da Semana',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_featured_active ON featured_posts(active, created_at DESC);

ALTER TABLE featured_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read featured posts" ON featured_posts
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage featured posts" ON featured_posts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ============================================================
-- 8. FEATURE FLAGS (additional entries in content_filters)
-- ============================================================

INSERT INTO content_filters (id, label, pattern, filter_type, enabled) VALUES
    ('dm_feature', 'Mensagens Diretas (Chat)', '', 'feature_flag', false),
    ('anonymous_posts', 'Posts Anonimos', '', 'feature_flag', true),
    ('member_topic_creation', 'Criacao de Temas por Membros', '', 'feature_flag', true),
    ('open_registration', 'Cadastro Aberto', '', 'feature_flag', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. DASHBOARD RPC FUNCTIONS
-- ============================================================

-- Active members in last N days
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_result JSON;
BEGIN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_uid;
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

    SELECT json_build_object(
        'total_members', (SELECT COUNT(*) FROM profiles WHERE banned_at IS NULL),
        'members_7d', (SELECT COUNT(DISTINCT user_id) FROM posts WHERE created_at >= now() - interval '7 days'),
        'members_30d', (SELECT COUNT(DISTINCT user_id) FROM posts WHERE created_at >= now() - interval '30 days'),
        'new_members_7d', (SELECT COUNT(*) FROM profiles WHERE created_at >= now() - interval '7 days' AND banned_at IS NULL),
        'new_members_30d', (SELECT COUNT(*) FROM profiles WHERE created_at >= now() - interval '30 days' AND banned_at IS NULL),
        'posts_today', (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE AND status = 'visible'),
        'posts_7d', (SELECT COUNT(*) FROM posts WHERE created_at >= now() - interval '7 days' AND status = 'visible'),
        'posts_30d', (SELECT COUNT(*) FROM posts WHERE created_at >= now() - interval '30 days' AND status = 'visible'),
        'replies_7d', (SELECT COUNT(*) FROM replies WHERE created_at >= now() - interval '7 days'),
        'reactions_7d', (SELECT COUNT(*) FROM reactions WHERE created_at >= now() - interval '7 days'),
        'pending_reports', (SELECT COUNT(*) FROM reports WHERE status = 'pending'),
        'total_referrals', (SELECT COUNT(*) FROM profiles WHERE referred_by IS NOT NULL),
        'banned_members', (SELECT COUNT(*) FROM profiles WHERE banned_at IS NOT NULL)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Top topics by posts this week
CREATE OR REPLACE FUNCTION admin_get_top_topics(p_days INT DEFAULT 7)
RETURNS TABLE (topic_id UUID, topic_name TEXT, topic_emoji TEXT, post_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.emoji, COUNT(p.id) AS post_count
    FROM posts p
    JOIN topics t ON t.id = p.topic_id
    WHERE p.created_at >= now() - (p_days || ' days')::interval
      AND p.status = 'visible'
    GROUP BY t.id, t.name, t.emoji
    ORDER BY post_count DESC
    LIMIT 10;
END;
$$;

-- Posts per day (last 30 days)
CREATE OR REPLACE FUNCTION admin_get_posts_per_day(p_days INT DEFAULT 30)
RETURNS TABLE (day DATE, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT d.day::DATE, COALESCE(COUNT(p.id), 0) AS count
    FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day') AS d(day)
    LEFT JOIN posts p ON p.created_at::DATE = d.day AND p.status = 'visible'
    GROUP BY d.day
    ORDER BY d.day;
END;
$$;

-- Top referrers
CREATE OR REPLACE FUNCTION admin_get_top_referrers(p_limit INT DEFAULT 10)
RETURNS TABLE (user_id UUID, user_name TEXT, referral_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p.referred_by AS user_id, rp.name AS user_name, COUNT(*) AS referral_count
    FROM profiles p
    JOIN profiles rp ON rp.id = p.referred_by
    WHERE p.referred_by IS NOT NULL
    GROUP BY p.referred_by, rp.name
    ORDER BY referral_count DESC
    LIMIT p_limit;
END;
$$;

-- Weekly digest stats
CREATE OR REPLACE FUNCTION get_weekly_digest()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    RETURN json_build_object(
        'new_posts', (SELECT COUNT(*) FROM posts WHERE created_at >= now() - interval '7 days' AND status = 'visible'),
        'new_members', (SELECT COUNT(*) FROM profiles WHERE created_at >= now() - interval '7 days'),
        'new_replies', (SELECT COUNT(*) FROM replies WHERE created_at >= now() - interval '7 days'),
        'top_topic', (
            SELECT json_build_object('name', t.name, 'emoji', t.emoji, 'count', COUNT(p.id))
            FROM posts p JOIN topics t ON t.id = p.topic_id
            WHERE p.created_at >= now() - interval '7 days' AND p.status = 'visible'
            GROUP BY t.name, t.emoji
            ORDER BY COUNT(p.id) DESC LIMIT 1
        ),
        'your_streak', (SELECT current_streak FROM user_streaks WHERE user_id = v_uid),
        'week_start', (now() - interval '7 days')::DATE,
        'week_end', CURRENT_DATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_weekly_digest() TO authenticated;

-- ============================================================
-- 10. ONBOARDING STEPS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    chose_topic BOOLEAN DEFAULT false,
    made_first_post BOOLEAN DEFAULT false,
    followed_someone BOOLEAN DEFAULT false,
    set_avatar BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own onboarding" ON onboarding_progress
    FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- 11. GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON reports TO authenticated;
GRANT INSERT ON reports TO authenticated;
GRANT UPDATE ON reports TO authenticated;
GRANT SELECT ON announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT SELECT ON user_streaks TO authenticated;
GRANT INSERT, UPDATE ON user_streaks TO authenticated;
GRANT SELECT ON badge_definitions TO authenticated;
GRANT SELECT, INSERT ON user_badges TO authenticated;
GRANT SELECT ON featured_posts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON featured_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON onboarding_progress TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
