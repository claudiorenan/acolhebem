-- RPC function to set psi profile data
-- Runs as SECURITY DEFINER so trigger sees current_user as owner (passes check)
CREATE OR REPLACE FUNCTION set_psi_profile(
  p_id UUID,
  p_name TEXT,
  p_email TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, name, email, is_psi)
  VALUES (p_id, p_name, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_psi = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role can call this
REVOKE ALL ON FUNCTION set_psi_profile(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_psi_profile(UUID, TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION set_psi_profile(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION set_psi_profile(UUID, TEXT, TEXT) TO service_role;
