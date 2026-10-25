-- =============================================================================
-- FestFlow — Supabase Migration 002: Events & Posters Storage
-- =============================================================================
-- Run in your Supabase SQL editor or via the Supabase CLI:
--   supabase db push
-- =============================================================================

-- ─── Table: events ─────────────────────────────────────────────────────────
create table if not exists public.events (
  id                      uuid          primary key default gen_random_uuid(),
  slug                    text          unique not null,
  club_id                 uuid          not null references public.profiles(id) on delete cascade,
  title                   text          not null,
  summary                 text          not null,
  description             text          not null,
  category                text          not null check (category in (
                                          'tech', 'cultural', 'sports', 'workshop',
                                          'seminar', 'hackathon', 'music', 'art',
                                          'gaming', 'social'
                                        )),
  poster_url              text,
  start_date              timestamptz   not null,
  end_date                timestamptz   not null,
  venue_name              text          not null,
  venue_address           text,
  event_type              text          not null default 'offline' check (event_type in ('offline', 'online', 'hybrid')),
  registration_opens_at   timestamptz,
  registration_closes_at  timestamptz,
  capacity                int           not null check (capacity > 0),
  is_free                 boolean       not null default true,
  price                   numeric(10,2) not null default 0.00 check (price >= 0),
  currency                text          not null default 'INR',
  eligibility             text,
  status                  text          not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_at              timestamptz   not null default now(),
  updated_at              timestamptz   not null default now(),

  -- Constraints
  constraint end_date_after_start_date check (end_date >= start_date),
  constraint valid_registration_close check (registration_closes_at is null or registration_closes_at <= end_date)
);

-- ─── Trigger: updated_at ───────────────────────────────────────────────────
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_events_club_id    on public.events (club_id);
create index if not exists idx_events_status     on public.events (status);
create index if not exists idx_events_category   on public.events (category);
create index if not exists idx_events_start_date on public.events (start_date);
create index if not exists idx_events_slug       on public.events (slug);

-- ─── Row Level Security (RLS) ──────────────────────────────────────────────
alter table public.events enable row level security;

do $$
begin
  drop policy if exists "anyone can view published events" on public.events;
  drop policy if exists "clubs can view own events" on public.events;
  drop policy if exists "clubs can create own events" on public.events;
  drop policy if exists "clubs can update own events" on public.events;
  drop policy if exists "clubs can delete own events" on public.events;

  drop policy if exists "public can view event posters" on storage.objects;
  drop policy if exists "authenticated clubs can upload event posters" on storage.objects;
  drop policy if exists "clubs can update own event posters" on storage.objects;
  drop policy if exists "clubs can delete own event posters" on storage.objects;
end $$;

-- 1. Public can view published events
create policy "anyone can view published events"
  on public.events for select
  using (status = 'published');

-- 2. Clubs can view all their own events regardless of status
create policy "clubs can view own events"
  on public.events for select
  using (auth.uid() = club_id);

-- 3. Only authenticated club members/platform admins can insert events for themselves
create policy "clubs can create own events"
  on public.events for insert
  with check (
    auth.uid() = club_id and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('club_member', 'platform_admin')
    )
  );

-- 4. Only owning club can update their own events
create policy "clubs can update own events"
  on public.events for update
  using (auth.uid() = club_id)
  with check (auth.uid() = club_id);

-- 5. Only owning club can delete their own events
create policy "clubs can delete own events"
  on public.events for delete
  using (auth.uid() = club_id);

-- ─── Storage Bucket: event-posters ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-posters',
  'event-posters',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS: Public read access
create policy "public can view event posters"
  on storage.objects for select
  using (bucket_id = 'event-posters');

-- Storage RLS: Authenticated clubs upload to their own user folder
create policy "authenticated clubs can upload event posters"
  on storage.objects for insert
  with check (
    bucket_id = 'event-posters' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "clubs can update own event posters"
  on storage.objects for update
  using (
    bucket_id = 'event-posters' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "clubs can delete own event posters"
  on storage.objects for delete
  using (
    bucket_id = 'event-posters' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

