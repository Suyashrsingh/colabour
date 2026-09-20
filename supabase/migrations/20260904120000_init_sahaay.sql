-- Sahaay Phase 1+ schema: PostgreSQL + Auth + RLS
-- Apply in the Supabase SQL editor (or `supabase db push`) before using the app.
-- Additive vs BACKEND_HANDOFF.md: users.society_id, users.area (customer locality).

create extension if not exists "pgcrypto";

create type public.user_role as enum ('Customer', 'Worker', 'Admin');
create type public.verification_status as enum ('Pending', 'Verified', 'Rejected');
create type public.booking_status as enum ('Requested', 'Accepted', 'En Route', 'In Progress', 'Completed', 'Cancelled');
create type public.payment_method as enum ('UPI', 'Card', 'Cash');
create type public.payment_status as enum ('Pending', 'Paid');
create type public.claim_type as enum ('Health', 'Accident', 'Maternity', 'Other');
create type public.claim_status as enum ('Approved', 'Pending', 'Rejected');
create type public.issue_status as enum ('Open', 'Resolved');

create table public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  admin_email text,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null default '',
  phone text,
  area text,
  society_id uuid references public.societies (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.worker_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  society_id uuid references public.societies (id) on delete set null,
  membership_id text,
  service_category text not null,
  experience_years int not null default 0,
  area text not null default '',
  verification_status public.verification_status not null default 'Pending',
  uan_status text not null default 'UAN: DEMO-PENDING · Simulated',
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete restrict,
  worker_id uuid not null references public.users (id) on delete restrict,
  society_id uuid references public.societies (id) on delete set null,
  date text not null,
  time_slot text not null,
  description text,
  is_emergency boolean not null default false,
  status public.booking_status not null default 'Requested',
  price_estimate text,
  payment_method public.payment_method,
  payment_status public.payment_status not null default 'Pending',
  created_at timestamptz not null default now()
);

create table public.ratings (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  worker_id uuid not null references public.users (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  stars int not null check (stars >= 1 and stars <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.users (id) on delete cascade,
  society_id uuid references public.societies (id) on delete set null,
  type public.claim_type not null,
  amount text,
  status public.claim_status not null default 'Pending',
  date text,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.users (id) on delete cascade,
  society_id uuid references public.societies (id) on delete set null,
  subject text not null,
  description text,
  linked_booking_id uuid references public.bookings (id) on delete set null,
  status public.issue_status not null default 'Open',
  created_at timestamptz not null default now()
);

create index users_role_idx on public.users (role);
create index users_phone_idx on public.users (phone);
create index users_society_idx on public.users (society_id);
create index worker_profiles_verification_idx on public.worker_profiles (verification_status);
create index worker_profiles_category_idx on public.worker_profiles (service_category);
create index worker_profiles_area_idx on public.worker_profiles (area);
create index worker_profiles_society_idx on public.worker_profiles (society_id);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_worker_idx on public.bookings (worker_id);
create index bookings_society_idx on public.bookings (society_id);
create index bookings_status_idx on public.bookings (status);
create index issues_status_idx on public.issues (status);
create index issues_society_idx on public.issues (society_id);
create index claims_worker_idx on public.claims (worker_id);

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_society_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select society_id from public.users where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_society_id uuid;
  v_society_name text;
  v_experience int;
begin
  begin
    v_role := coalesce(nullif(new.raw_user_meta_data->>'role', '')::public.user_role, 'Customer');
  exception
    when invalid_text_representation then
      v_role := 'Customer';
  end;

  v_society_name := nullif(trim(new.raw_user_meta_data->>'society_name'), '');
  v_experience := coalesce(nullif(new.raw_user_meta_data->>'experience_years', '')::int, 2);

  if v_society_name is not null then
    insert into public.societies (name, admin_email)
    values (
      v_society_name,
      case when v_role = 'Admin' then new.email else null end
    )
    on conflict (name) do update
      set admin_email = coalesce(public.societies.admin_email, excluded.admin_email)
    returning id into v_society_id;
  end if;

  insert into public.users (id, role, full_name, phone, area, society_id)
  values (
    new.id,
    v_role,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    nullif(trim(new.raw_user_meta_data->>'area'), ''),
    v_society_id
  );

  if v_role = 'Worker' then
    insert into public.worker_profiles (
      user_id,
      society_id,
      membership_id,
      service_category,
      experience_years,
      area,
      verification_status,
      uan_status
    ) values (
      new.id,
      v_society_id,
      nullif(trim(new.raw_user_meta_data->>'membership_id'), ''),
      coalesce(nullif(trim(new.raw_user_meta_data->>'service_category'), ''), 'Electrician'),
      v_experience,
      coalesce(nullif(trim(new.raw_user_meta_data->>'area'), ''), ''),
      'Pending',
      'UAN: DEMO-PENDING · Simulated'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Role cannot be changed from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_role_change on public.users;
create trigger users_prevent_role_change
  before update on public.users
  for each row execute function public.prevent_privilege_escalation();

create or replace function public.protect_worker_verification()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status is distinct from old.verification_status
     or new.society_id is distinct from old.society_id then
    if public.current_role() is distinct from 'Admin' then
      raise exception 'Only a cooperative admin can change verification or society';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists worker_profiles_protect_verification on public.worker_profiles;
create trigger worker_profiles_protect_verification
  before update on public.worker_profiles
  for each row execute function public.protect_worker_verification();

alter table public.societies enable row level security;
alter table public.users enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.ratings enable row level security;
alter table public.claims enable row level security;
alter table public.issues enable row level security;

create policy societies_read on public.societies
  for select to anon, authenticated
  using (true);

create policy societies_insert_admin on public.societies
  for insert to authenticated
  with check (public.current_role() = 'Admin');

create policy users_select_own on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_select_admin_society on public.users
  for select to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id is not null
    and society_id = public.current_society_id()
  );

create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy worker_profiles_select_verified on public.worker_profiles
  for select to anon, authenticated
  using (verification_status = 'Verified');

create policy worker_profiles_select_own on public.worker_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy worker_profiles_select_admin_society on public.worker_profiles
  for select to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id is not null
    and society_id = public.current_society_id()
  );

create policy worker_profiles_update_own on public.worker_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy worker_profiles_update_admin on public.worker_profiles
  for update to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id = public.current_society_id()
  )
  with check (
    public.current_role() = 'Admin'
    and society_id = public.current_society_id()
  );

create policy bookings_select_customer on public.bookings
  for select to authenticated
  using (customer_id = auth.uid());

create policy bookings_select_worker on public.bookings
  for select to authenticated
  using (worker_id = auth.uid());

create policy bookings_select_admin on public.bookings
  for select to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id is not null
    and society_id = public.current_society_id()
  );

create policy bookings_insert_customer on public.bookings
  for insert to authenticated
  with check (customer_id = auth.uid());

create policy bookings_update_customer on public.bookings
  for update to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy bookings_update_worker on public.bookings
  for update to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());

create policy ratings_select_related on public.ratings
  for select to authenticated
  using (customer_id = auth.uid() or worker_id = auth.uid() or public.current_role() = 'Admin');

create policy ratings_insert_customer on public.ratings
  for insert to authenticated
  with check (customer_id = auth.uid());

create policy claims_select_worker on public.claims
  for select to authenticated
  using (worker_id = auth.uid());

create policy claims_select_admin on public.claims
  for select to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id is not null
    and society_id = public.current_society_id()
  );

create policy claims_insert_admin on public.claims
  for insert to authenticated
  with check (
    public.current_role() = 'Admin'
    and society_id = public.current_society_id()
  );

create policy claims_update_admin on public.claims
  for update to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id = public.current_society_id()
  )
  with check (
    public.current_role() = 'Admin'
    and society_id = public.current_society_id()
  );

create policy issues_select_own on public.issues
  for select to authenticated
  using (raised_by = auth.uid());

create policy issues_select_admin on public.issues
  for select to authenticated
  using (
    public.current_role() = 'Admin'
    and society_id is not null
    and society_id = public.current_society_id()
  );

create policy issues_insert_own on public.issues
  for insert to authenticated
  with check (raised_by = auth.uid());

create policy issues_update_admin on public.issues
  for update to authenticated
  using (public.current_role() = 'Admin')
  with check (public.current_role() = 'Admin');

grant usage on schema public to anon, authenticated;
grant select on table public.societies to anon, authenticated;
grant insert on table public.societies to authenticated;
grant select, update on table public.users to authenticated;
grant select on table public.worker_profiles to anon, authenticated;
grant update on table public.worker_profiles to authenticated;
grant select, insert, update on table public.bookings to authenticated;
grant select, insert on table public.ratings to authenticated;
grant select, insert, update on table public.claims to authenticated;
grant select, insert, update on table public.issues to authenticated;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_society_id() to authenticated;

insert into public.societies (name, admin_email)
values ('Gurugram Service Cooperative', 'admin@gurugramcoop.in')
on conflict (name) do nothing;
