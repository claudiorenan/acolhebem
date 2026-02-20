-- ============================================================
-- MESSAGES CONTENT FILTER
-- Apply existing check_content_contact_info() trigger to DM messages
-- Defense-in-depth: blocks phone, email, URLs, social handles server-side
-- ============================================================

-- Apply content filter to messages table (reuses function from content_filter migration)
DROP TRIGGER IF EXISTS check_messages_contact_info ON messages;
CREATE TRIGGER check_messages_contact_info
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_content_contact_info();
