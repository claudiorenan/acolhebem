-- ============================================================
-- CHECKIN REACTIONS & REPLIES
-- Tables for reactions and replies on activity checkins
-- ============================================================

-- CHECKIN REACTIONS
CREATE TABLE IF NOT EXISTS checkin_reactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id    UUID NOT NULL REFERENCES activity_checkins(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'like'
        CHECK (reaction_type IN ('like','hug','strength','welcome','thanks')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (checkin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_reactions_checkin ON checkin_reactions(checkin_id);

ALTER TABLE checkin_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read checkin_reactions" ON checkin_reactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "own insert checkin_reactions" ON checkin_reactions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "own delete checkin_reactions" ON checkin_reactions
    FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "own update checkin_reactions" ON checkin_reactions
    FOR UPDATE USING (user_id = auth.uid());


-- CHECKIN REPLIES
CREATE TABLE IF NOT EXISTS checkin_replies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id  UUID NOT NULL REFERENCES activity_checkins(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkin_replies_checkin ON checkin_replies(checkin_id, created_at ASC);

ALTER TABLE checkin_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read checkin_replies" ON checkin_replies
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "own insert checkin_replies" ON checkin_replies
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "own delete checkin_replies" ON checkin_replies
    FOR DELETE USING (user_id = auth.uid());
