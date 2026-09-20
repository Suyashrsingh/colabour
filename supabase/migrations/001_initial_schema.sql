-- ============================================================
-- Sahaay Cooperative Gig Services Platform
-- Migration 001: Initial Schema
-- Run this SQL in Supabase SQL Editor (Project > SQL Editor > New Query)
-- ============================================================

-- ── ENUMS ──────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('Customer', 'Worker', 'Admin');
CREATE TYPE verification_status AS ENUM ('Pending', 'Verified', 'Rejected');
CREATE TYPE booking_status AS ENUM ('Requested', 'Accepted', 'En Route', 'In Progress', 'Completed', 'Cancelled');
CREATE TYPE payment_method AS ENUM ('UPI', 'Card', 'Cash');
CREATE TYPE payment_status AS ENUM ('Pending', 'Paid');
CREATE TYPE issue_status AS ENUM ('Open', 'Resolved');
CREATE TYPE claim_type AS ENUM ('Health', 'Accident', 'Maternity', 'Other');
CREATE TYPE claim_status AS ENUM ('Approved', 'Pending', 'Rejected');

-- ── SOCIETIES ──────────────────────────────────────────────
CREATE TABLE societies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  admin_email TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── USERS (public profile, mirrors auth.users) ─────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'Customer',
  full_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT,
  area        TEXT,
  society_id  UUID REFERENCES societies(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── WORKER PROFILES ────────────────────────────────────────
CREATE TABLE worker_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  society_id          UUID REFERENCES societies(id) ON DELETE SET NULL,
  membership_id       TEXT,
  service_category    TEXT NOT NULL DEFAULT 'General',
  experience_years    INT  NOT NULL DEFAULT 1,
  area                TEXT,
  verification_status verification_status NOT NULL DEFAULT 'Pending',
  uan_status          TEXT DEFAULT 'DEMO-88213',
  avg_rating          NUMERIC(3,2) DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── BOOKINGS ───────────────────────────────────────────────
CREATE TABLE bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society_id     UUID REFERENCES societies(id) ON DELETE SET NULL,
  date           TEXT NOT NULL,
  time_slot      TEXT NOT NULL,
  description    TEXT,
  is_emergency   BOOLEAN NOT NULL DEFAULT false,
  status         booking_status NOT NULL DEFAULT 'Requested',
  price_estimate TEXT NOT NULL DEFAULT '₹300',
  payment_method payment_method,
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── RATINGS ────────────────────────────────────────────────
CREATE TABLE ratings (
  booking_id  UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars       INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── CLAIMS ─────────────────────────────────────────────────
CREATE TABLE claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society_id  UUID REFERENCES societies(id) ON DELETE SET NULL,
  type        claim_type NOT NULL DEFAULT 'Health',
  amount      TEXT,
  status      claim_status NOT NULL DEFAULT 'Pending',
  date        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── ISSUES ─────────────────────────────────────────────────
CREATE TABLE issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  society_id        UUID REFERENCES societies(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  description       TEXT,
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  status            issue_status NOT NULL DEFAULT 'Open',
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_users_role          ON users(role);
CREATE INDEX idx_users_society       ON users(society_id);
CREATE INDEX idx_worker_society      ON worker_profiles(society_id);
CREATE INDEX idx_worker_vstatus      ON worker_profiles(verification_status);
CREATE INDEX idx_worker_category     ON worker_profiles(service_category);
CREATE INDEX idx_bookings_customer   ON bookings(customer_id);
CREATE INDEX idx_bookings_worker     ON bookings(worker_id);
CREATE INDEX idx_bookings_society    ON bookings(society_id);
CREATE INDEX idx_bookings_status     ON bookings(status);
CREATE INDEX idx_claims_worker       ON claims(worker_id);
CREATE INDEX idx_issues_raised_by    ON issues(raised_by);
CREATE INDEX idx_issues_society      ON issues(society_id);
CREATE INDEX idx_issues_status       ON issues(status);

-- ── TRIGGER: auto-create user row on auth.users insert ─────
-- This runs server-side when Supabase Auth creates a new user.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_society_id   UUID;
  v_role         user_role;
  v_society_name TEXT;
BEGIN
  v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  IF v_role IS NULL THEN v_role := 'Customer'; END IF;

  v_society_name := NEW.raw_user_meta_data->>'society_name';

  -- Resolve or create society for Admin/Worker
  IF v_society_name IS NOT NULL AND v_society_name != '' AND v_role IN ('Admin', 'Worker') THEN
    SELECT id INTO v_society_id FROM societies WHERE LOWER(name) = LOWER(v_society_name) LIMIT 1;
    IF v_society_id IS NULL THEN
      INSERT INTO societies (name, admin_email)
      VALUES (v_society_name, NEW.email)
      RETURNING id INTO v_society_id;
    END IF;
  END IF;

  -- Insert public user row
  INSERT INTO users (id, role, full_name, phone, area, society_id)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'area',
    v_society_id
  );

  -- Insert worker profile if role = Worker
  IF v_role = 'Worker' THEN
    INSERT INTO worker_profiles (
      user_id, society_id, membership_id, service_category, experience_years, area
    ) VALUES (
      NEW.id,
      v_society_id,
      NEW.raw_user_meta_data->>'membership_id',
      COALESCE(NEW.raw_user_meta_data->>'service_category', 'General'),
      COALESCE((NEW.raw_user_meta_data->>'experience_years')::INT, 1),
      NEW.raw_user_meta_data->>'area'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── SEED: Demo Cooperative Society ─────────────────────────
INSERT INTO societies (name, admin_email)
VALUES ('Gurugram Service Cooperative', 'admin@gurugram-coop.in')
ON CONFLICT (name) DO NOTHING;
