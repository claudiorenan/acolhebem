-- ============================================================
-- AcolheBem — Admin & Moderation Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add is_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Add status column to posts (visible, hidden, deleted)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'visible'
  CHECK (status IN ('visible', 'hidden', 'deleted'));

-- 3. Add status column to replies
ALTER TABLE replies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'visible'
  CHECK (status IN ('visible', 'hidden', 'deleted'));

-- 4. Set claudiorenan1@gmail.com as admin
UPDATE profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'claudiorenan1@gmail.com'
);

-- 5. Admin RLS policies — admin can do everything

-- profiles: admin can update any profile
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- posts: admin can update any post (for status changes)
DROP POLICY IF EXISTS "posts_admin_update" ON posts;
CREATE POLICY "posts_admin_update" ON posts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- posts: admin can delete any post
DROP POLICY IF EXISTS "posts_admin_delete" ON posts;
CREATE POLICY "posts_admin_delete" ON posts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- replies: admin can update any reply (for status changes)
DROP POLICY IF EXISTS "replies_admin_update" ON replies;
CREATE POLICY "replies_admin_update" ON replies
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- replies: admin can delete any reply
DROP POLICY IF EXISTS "replies_admin_delete" ON replies;
CREATE POLICY "replies_admin_delete" ON replies
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- topics: admin can update any topic (including default ones)
DROP POLICY IF EXISTS "topics_admin_update" ON topics;
CREATE POLICY "topics_admin_update" ON topics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- topics: admin can delete any topic
DROP POLICY IF EXISTS "topics_admin_delete" ON topics;
CREATE POLICY "topics_admin_delete" ON topics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. Add whatsapp_link column to topics for admin-editable links
ALTER TABLE topics ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;
