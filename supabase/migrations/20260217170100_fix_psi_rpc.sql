-- Fix: Use UPDATE instead of INSERT ON CONFLICT
-- The profile already exists (created by Supabase Auth trigger)
-- and INSERT fails due to NOT NULL constraints on other columns
CREATE OR REPLACE FUNCTION set_psi_profile(
  p_id UUID,
  p_name TEXT,
  p_email TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET name = p_name,
      email = p_email,
      is_psi = true
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
