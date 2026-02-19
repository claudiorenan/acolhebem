-- ============================================================
-- Activity Check-ins — Aba Atividade Fisica
-- Run this in Supabase Dashboard SQL Editor
-- ============================================================

CREATE TABLE activity_checkins (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type    TEXT NOT NULL CHECK (activity_type IN (
        'caminhada','corrida','musculacao','yoga','natacao','danca','ciclismo','outro'
    )),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 600),
    note             TEXT CHECK (char_length(note) <= 500),
    motivation_message TEXT CHECK (char_length(motivation_message) <= 280),
    checkin_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, checkin_date)
);

-- Indexes
CREATE INDEX idx_activity_user ON activity_checkins(user_id, checkin_date DESC);
CREATE INDEX idx_activity_motiv ON activity_checkins(created_at DESC) WHERE motivation_message IS NOT NULL;

-- RLS
ALTER TABLE activity_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_own"  ON activity_checkins FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "read_all"    ON activity_checkins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "update_own"  ON activity_checkins FOR UPDATE USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON activity_checkins TO authenticated;
