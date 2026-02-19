-- Add link_url column to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
