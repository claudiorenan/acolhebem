-- Fix protect_psi_fields trigger to check JWT role claim
-- The service_role key sets the role via JWT, not via current_setting('role')
CREATE OR REPLACE FUNCTION protect_psi_fields()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  -- Check JWT role claim (how Supabase service_role actually works)
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  -- Allow service_role or postgres superuser
  IF jwt_role = 'service_role' OR current_setting('role', true) = 'service_role' OR current_user = 'postgres' THEN
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
