-- ============================================================
-- AcolheBem — Direct Messages (DM) Migration
-- Creates conversations, participants, messages tables with
-- RLS policies, RPC functions, and triggers.
-- ============================================================

-- 1. Tables
-- ------------------------------------------------------------

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- 2. Indexes
-- ------------------------------------------------------------

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- 3. Enable RLS
-- ------------------------------------------------------------

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- ------------------------------------------------------------

-- conversations: SELECT where user is a participant
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = conversations.id
              AND conversation_participants.user_id = auth.uid()
        )
    );

-- conversation_participants: SELECT where user is participant of the same conversation
CREATE POLICY "Users can view participants of their conversations"
    ON conversation_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants AS cp
            WHERE cp.conversation_id = conversation_participants.conversation_id
              AND cp.user_id = auth.uid()
        )
    );

-- messages: SELECT where user is participant of the conversation
CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = messages.conversation_id
              AND conversation_participants.user_id = auth.uid()
        )
    );

-- messages: INSERT where user is participant AND sender_id = auth.uid()
CREATE POLICY "Users can send messages in their conversations"
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = messages.conversation_id
              AND conversation_participants.user_id = auth.uid()
        )
    );

-- messages: UPDATE (only read_at, for marking as read)
CREATE POLICY "Users can mark messages as read"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = messages.conversation_id
              AND conversation_participants.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = messages.conversation_id
              AND conversation_participants.user_id = auth.uid()
        )
    );

-- 5. RPC Functions
-- ------------------------------------------------------------

-- get_or_create_conversation: atomic upsert for 1-on-1 DM
CREATE OR REPLACE FUNCTION get_or_create_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conv_id UUID;
    v_my_id UUID := auth.uid();
BEGIN
    IF v_my_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_my_id = p_other_user_id THEN
        RAISE EXCEPTION 'Cannot message yourself';
    END IF;

    -- Find existing 1-on-1 conversation between these two users
    SELECT cp1.conversation_id INTO v_conv_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = v_my_id
      AND cp2.user_id = p_other_user_id
    -- Ensure it's exactly a 2-person conversation
    AND (
        SELECT COUNT(*) FROM conversation_participants cp3
        WHERE cp3.conversation_id = cp1.conversation_id
    ) = 2
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    -- Create new conversation
    INSERT INTO conversations DEFAULT VALUES
    RETURNING id INTO v_conv_id;

    -- Add both participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_my_id), (v_conv_id, p_other_user_id);

    RETURN v_conv_id;
END;
$$;

-- get_conversations_list: returns user's conversations with last message, unread count, other participant
CREATE OR REPLACE FUNCTION get_conversations_list()
RETURNS TABLE (
    conversation_id UUID,
    updated_at TIMESTAMPTZ,
    other_user_id UUID,
    other_user_name TEXT,
    other_user_photo TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_my_id UUID := auth.uid();
BEGIN
    IF v_my_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    SELECT
        c.id AS conversation_id,
        c.updated_at,
        other_cp.user_id AS other_user_id,
        p.name AS other_user_name,
        p.photo_url AS other_user_photo,
        last_msg.content AS last_message,
        last_msg.created_at AS last_message_at,
        COALESCE(unread.cnt, 0) AS unread_count
    FROM conversations c
    JOIN conversation_participants my_cp
        ON my_cp.conversation_id = c.id AND my_cp.user_id = v_my_id
    JOIN conversation_participants other_cp
        ON other_cp.conversation_id = c.id AND other_cp.user_id <> v_my_id
    JOIN profiles p
        ON p.id = other_cp.user_id
    LEFT JOIN LATERAL (
        SELECT m.content, m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) last_msg ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> v_my_id
          AND m.read_at IS NULL
    ) unread ON true
    ORDER BY c.updated_at DESC;
END;
$$;

-- get_unread_dm_count: total unread DMs for badge
CREATE OR REPLACE FUNCTION get_unread_dm_count()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_my_id UUID := auth.uid();
    v_count BIGINT;
BEGIN
    IF v_my_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM messages m
    JOIN conversation_participants cp
        ON cp.conversation_id = m.conversation_id AND cp.user_id = v_my_id
    WHERE m.sender_id <> v_my_id
      AND m.read_at IS NULL;

    RETURN v_count;
END;
$$;

-- 6. Trigger: update conversations.updated_at on new message
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION on_new_message();

-- 7. Enable realtime for messages table
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
