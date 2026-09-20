-- ============================================================
-- Sahaay Cooperative Gig Services Platform
-- Migration 003: Fix Trigger
-- Makes the auto-create user trigger bulletproof against schema resolution issues & missing metadata.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_society_id   UUID;
  v_role_str     TEXT;
  v_role         public.user_role;
  v_society_name TEXT;
  v_exp_str      TEXT;
  v_exp          INT;
BEGIN
  -- Safely parse role
  v_role_str := NEW.raw_user_meta_data->>'role';
  IF v_role_str IN ('Admin', 'Worker', 'Customer') THEN
    v_role := v_role_str::public.user_role;
  ELSE
    v_role := 'Customer'::public.user_role;
  END IF;

  -- Safely parse experience years
  v_exp_str := NEW.raw_user_meta_data->>'experience_years';
  IF v_exp_str ~ '^[0-9]+$' THEN
    v_exp := v_exp_str::INT;
  ELSE
    v_exp := 1;
  END IF;

  v_society_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'society_name'), '');

  -- Resolve or create society for Admin/Worker
  IF v_society_name IS NOT NULL AND v_role IN ('Admin', 'Worker') THEN
    SELECT id INTO v_society_id FROM public.societies WHERE LOWER(name) = LOWER(v_society_name) LIMIT 1;
    IF v_society_id IS NULL THEN
      INSERT INTO public.societies (name, admin_email)
      VALUES (v_society_name, COALESCE(NEW.email, 'unknown@coop.local'))
      ON CONFLICT (name) DO UPDATE SET admin_email = EXCLUDED.admin_email
      RETURNING id INTO v_society_id;
    END IF;
  END IF;

  -- Insert public user row (use public.users to avoid collision with auth.users)
  INSERT INTO public.users (id, role, full_name, phone, area, society_id)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'area',
    v_society_id
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    area = EXCLUDED.area,
    society_id = COALESCE(EXCLUDED.society_id, public.users.society_id);

  -- Insert worker profile if role = Worker
  IF v_role = 'Worker' THEN
    INSERT INTO public.worker_profiles (
      user_id, society_id, membership_id, service_category, experience_years, area
    ) VALUES (
      NEW.id,
      v_society_id,
      NEW.raw_user_meta_data->>'membership_id',
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'service_category'), ''), 'General'),
      v_exp,
      NEW.raw_user_meta_data->>'area'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log warning without failing the auth signup transaction
  RAISE WARNING 'handle_new_user failed: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to ensure it points to the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
