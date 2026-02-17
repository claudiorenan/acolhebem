-- ============================================================
-- PSI AUTH MIGRATION
-- Adds psychologist identification columns to profiles
-- ============================================================

-- Add columns for psychologist identification
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_psi BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cademeupsi_id INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crp TEXT;

-- Partial index for fast lookup of psychologists
CREATE INDEX IF NOT EXISTS idx_profiles_is_psi ON profiles(is_psi) WHERE is_psi = true;

-- ============================================================
-- SECURITY: Prevent normal users from setting is_psi/cademeupsi_id
-- Only service_role (Edge Function) can set these fields
-- ============================================================

CREATE OR REPLACE FUNCTION protect_psi_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role to do anything
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For normal users, preserve the old values of protected fields
  IF TG_OP = 'UPDATE' THEN
    NEW.is_psi := OLD.is_psi;
    NEW.cademeupsi_id := OLD.cademeupsi_id;
    NEW.crp := OLD.crp;
  END IF;

  -- For inserts by non-service roles, force defaults
  IF TG_OP = 'INSERT' THEN
    NEW.is_psi := false;
    NEW.cademeupsi_id := NULL;
    NEW.crp := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_psi_fields_trigger ON profiles;
CREATE TRIGGER protect_psi_fields_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_psi_fields();
