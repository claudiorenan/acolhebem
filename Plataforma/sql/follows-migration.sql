-- ============================================================
-- AcolheBem — Follows Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create user_follows table
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- 2. Indices for fast lookup
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);

-- 3. RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follows (needed to show follow state)
CREATE POLICY "Anyone can read follows"
  ON user_follows FOR SELECT
  USING (true);

-- Users can insert their own follows
CREATE POLICY "Users can follow others"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);
