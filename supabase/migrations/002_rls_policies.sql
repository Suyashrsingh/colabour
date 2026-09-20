-- ============================================================
-- Sahaay Cooperative Gig Services Platform
-- Migration 002: Row Level Security (RLS)
-- Run this AFTER 001_initial_schema.sql
-- ============================================================

-- ── Enable RLS on all tables ────────────────────────────────
ALTER TABLE societies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims         ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues         ENABLE ROW LEVEL SECURITY;

-- ── Helper: get the current user's role ────────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- ── Helper: get the current user's society_id ──────────────
CREATE OR REPLACE FUNCTION current_society_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT society_id FROM users WHERE id = auth.uid()
$$;

-- ───────────────────────────────────────────────────────────
-- SOCIETIES
-- ───────────────────────────────────────────────────────────
-- Everyone can read societies (used in signup dropdown)
CREATE POLICY "societies_select_all"
  ON societies FOR SELECT USING (true);

-- Only authenticated users can insert (handled via trigger, but keep policy safe)
CREATE POLICY "societies_insert_auth"
  ON societies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ───────────────────────────────────────────────────────────
-- USERS
-- ───────────────────────────────────────────────────────────
-- Users can read their own row
CREATE POLICY "users_select_self"
  ON users FOR SELECT USING (auth.uid() = id);

-- Admins can read all users in their society
CREATE POLICY "users_select_admin"
  ON users FOR SELECT USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

-- Users can update their own row (name, phone, area)
CREATE POLICY "users_update_self"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Trigger-only insert (no direct insert from client)
CREATE POLICY "users_insert_trigger"
  ON users FOR INSERT WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
-- WORKER PROFILES
-- ───────────────────────────────────────────────────────────
-- PUBLIC read: customers need to search workers
CREATE POLICY "worker_profiles_select_public"
  ON worker_profiles FOR SELECT USING (true);

-- Workers can update their own area / availability
CREATE POLICY "worker_profiles_update_self"
  ON worker_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Workers cannot change their own verification_status
    verification_status = (SELECT verification_status FROM worker_profiles WHERE user_id = auth.uid())
  );

-- Admins can update verification_status for workers in their society
CREATE POLICY "worker_profiles_update_admin"
  ON worker_profiles FOR UPDATE
  USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

-- Trigger-only insert
CREATE POLICY "worker_profiles_insert_trigger"
  ON worker_profiles FOR INSERT WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
-- BOOKINGS
-- ───────────────────────────────────────────────────────────
-- Customers see their own bookings
CREATE POLICY "bookings_select_customer"
  ON bookings FOR SELECT USING (auth.uid() = customer_id);

-- Workers see their own assigned bookings
CREATE POLICY "bookings_select_worker"
  ON bookings FOR SELECT USING (auth.uid() = worker_id);

-- Admins see all bookings in their society
CREATE POLICY "bookings_select_admin"
  ON bookings FOR SELECT USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

-- Customers can create bookings
CREATE POLICY "bookings_insert_customer"
  ON bookings FOR INSERT
  WITH CHECK (
    current_user_role() = 'Customer'
    AND auth.uid() = customer_id
  );

-- Workers can update status (accept, advance, cancel)
CREATE POLICY "bookings_update_worker"
  ON bookings FOR UPDATE
  USING (auth.uid() = worker_id);

-- Customers can update status (cancel before In Progress) and payment
CREATE POLICY "bookings_update_customer"
  ON bookings FOR UPDATE
  USING (auth.uid() = customer_id);

-- ───────────────────────────────────────────────────────────
-- RATINGS
-- ───────────────────────────────────────────────────────────
-- Workers and relevant customer can read ratings
CREATE POLICY "ratings_select"
  ON ratings FOR SELECT
  USING (auth.uid() = worker_id OR auth.uid() = customer_id);

-- Admins can read all ratings in their society's bookings
CREATE POLICY "ratings_select_admin"
  ON ratings FOR SELECT
  USING (current_user_role() = 'Admin');

-- Only customers can insert a rating, after completion
CREATE POLICY "ratings_insert_customer"
  ON ratings FOR INSERT
  WITH CHECK (
    current_user_role() = 'Customer'
    AND auth.uid() = customer_id
  );

-- ───────────────────────────────────────────────────────────
-- CLAIMS
-- ───────────────────────────────────────────────────────────
-- Workers read their own claims
CREATE POLICY "claims_select_worker"
  ON claims FOR SELECT USING (auth.uid() = worker_id);

-- Admins read/insert/update claims for workers in their society
CREATE POLICY "claims_select_admin"
  ON claims FOR SELECT
  USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

CREATE POLICY "claims_insert_admin"
  ON claims FOR INSERT
  WITH CHECK (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

CREATE POLICY "claims_update_admin"
  ON claims FOR UPDATE
  USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

-- ───────────────────────────────────────────────────────────
-- ISSUES
-- ───────────────────────────────────────────────────────────
-- Users can read issues they raised
CREATE POLICY "issues_select_self"
  ON issues FOR SELECT USING (auth.uid() = raised_by);

-- Admins see all issues in their society
CREATE POLICY "issues_select_admin"
  ON issues FOR SELECT
  USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );

-- Authenticated users (Customer/Worker) can submit issues
CREATE POLICY "issues_insert_auth"
  ON issues FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = raised_by
  );

-- Admins can resolve (update status)
CREATE POLICY "issues_update_admin"
  ON issues FOR UPDATE
  USING (
    current_user_role() = 'Admin'
    AND society_id = current_society_id()
  );
