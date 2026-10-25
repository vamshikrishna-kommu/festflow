-- =============================================================================
-- FestFlow — Supabase Migration 001: Auth Profiles & Row Level Security
-- =============================================================================
-- Run this in your Supabase SQL editor or via the Supabase CLI:
--   supabase db push
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- ─── Enum: user roles ──────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'club_member', 'platform_admin');
  end if;
end $$;

-- ─── Table: profiles ───────────────────────────────────────────────────────
-- One row per auth.users entry. Role is set server-side by the signup trigger.
create table if not exists public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  role          public.user_role not null default 'student',
  display_name  text        not null,
  email         text        not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Table: club_profiles ──────────────────────────────────────────────────
create table if not exists public.club_profiles (
  id                   uuid        primary key default gen_random_uuid(),
  profile_id           uuid        not null unique references public.profiles(id) on delete cascade,
  club_name            text        not null,
  representative_name  text        not null,
  website_url          text,
  description          text,
  is_verified          boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── Table: student_profiles ───────────────────────────────────────────────
create table if not exists public.student_profiles (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        not null unique references public.profiles(id) on delete cascade,
  college_name     text,
  graduation_year  int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── updated_at function & triggers ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists club_profiles_updated_at on public.club_profiles;
create trigger club_profiles_updated_at
  before update on public.club_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists student_profiles_updated_at on public.student_profiles;
create trigger student_profiles_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

-- ─── Trigger: auto-create profile on auth.users insert ────────────────────
-- Role is derived from user_metadata.role set by the app at signup time.
-- The value is validated against the enum — unknown values fall back to 'student'.
-- SECURITY: platform_admin cannot be self-assigned via signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _role public.user_role;
  _name text;
begin
  -- Safely coerce role — only 'club_member' can be chosen at signup; everything else becomes 'student'
  begin
    _role := case
      when new.raw_user_meta_data->>'role' = 'club_member' then 'club_member'::public.user_role
      else 'student'::public.user_role
    end;
  exception when others then
    _role := 'student'::public.user_role;
  end;

  _name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, role, display_name, email)
  values (new.id, _role, _name, new.email)
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();

  -- Create the role-specific sub-profile
  if _role = 'club_member' then
    insert into public.club_profiles (profile_id, club_name, representative_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'club_name'), ''), 'Unnamed Club'),
      _name
    )
    on conflict (profile_id) do update set
      club_name = coalesce(nullif(trim(new.raw_user_meta_data->>'club_name'), ''), club_profiles.club_name),
      representative_name = excluded.representative_name,
      updated_at = now();
  else
    insert into public.student_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.club_profiles   enable row level security;
alter table public.student_profiles enable row level security;

-- Safe drop policies before recreate
do $$
begin
  drop policy if exists "users can read own profile" on public.profiles;
  drop policy if exists "anyone can read public profiles" on public.profiles;
  drop policy if exists "users can update own profile (non-role fields)" on public.profiles;
  drop policy if exists "club members can read own club profile" on public.club_profiles;
  drop policy if exists "club members can update own club profile" on public.club_profiles;
  drop policy if exists "anyone can read club names" on public.club_profiles;
  drop policy if exists "students can read own student profile" on public.student_profiles;
  drop policy if exists "students can update own student profile" on public.student_profiles;
end $$;

-- profiles: users can read their own profile; anyone can view display_name/role for organizers
create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "anyone can read public profiles"
  on public.profiles for select
  using (role in ('club_member', 'platform_admin'));

create policy "users can update own profile (non-role fields)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- club_profiles: club members can read/update their own club profile; public can read club details
create policy "club members can read own club profile"
  on public.club_profiles for select
  using (auth.uid() = profile_id);

create policy "club members can update own club profile"
  on public.club_profiles for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "anyone can read club names"
  on public.club_profiles for select
  using (true);

-- student_profiles: students can read/update their own
create policy "students can read own student profile"
  on public.student_profiles for select
  using (auth.uid() = profile_id);

create policy "students can update own student profile"
  on public.student_profiles for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_club_profiles_profile_id on public.club_profiles (profile_id);
create index if not exists idx_student_profiles_profile_id on public.student_profiles (profile_id);
