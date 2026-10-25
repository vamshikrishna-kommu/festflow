-- =============================================================================
-- FestFlow — Supabase Migration 003: Student Registrations & Digital Tickets
-- =============================================================================
-- Run in your Supabase SQL editor or via the Supabase CLI:
--   supabase db push
-- =============================================================================

-- ─── Enum: registration status ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'registration_status') then
    create type public.registration_status as enum ('pending_payment', 'confirmed', 'cancelled', 'rejected');
  end if;
end $$;

-- ─── Table: registrations ──────────────────────────────────────────────────
create table if not exists public.registrations (
  id                uuid                  primary key default gen_random_uuid(),
  event_id          uuid                  not null references public.events(id) on delete cascade,
  student_id        uuid                  not null references public.profiles(id) on delete cascade,
  ticket_code       text                  unique not null,
  status            registration_status   not null default 'pending_payment',
  created_at        timestamptz           not null default now(),
  ticket_issued_at  timestamptz,
  cancelled_at      timestamptz,
  updated_at        timestamptz           not null default now(),

  -- Constraint: Enforce one registration record per student per event
  constraint unique_student_event unique (event_id, student_id)
);

-- ─── Trigger: updated_at ───────────────────────────────────────────────────
drop trigger if exists registrations_updated_at on public.registrations;
create trigger registrations_updated_at
  before update on public.registrations
  for each row execute function public.set_updated_at();

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_registrations_event_id     on public.registrations (event_id);
create index if not exists idx_registrations_student_id   on public.registrations (student_id);
create index if not exists idx_registrations_ticket_code  on public.registrations (ticket_code);
create index if not exists idx_registrations_status       on public.registrations (status);

-- ─── Row Level Security (RLS) ──────────────────────────────────────────────
alter table public.registrations enable row level security;

do $$
begin
  drop policy if exists "students can view own registrations" on public.registrations;
  drop policy if exists "clubs can view registrations for their events" on public.registrations;
  drop policy if exists "students can cancel own registration" on public.registrations;
  drop policy if exists "clubs can update registrations for their events" on public.registrations;
end $$;

-- 1. Students can view only their own registrations
create policy "students can view own registrations"
  on public.registrations for select
  using (auth.uid() = student_id);

-- 2. Clubs can view registrations for events they own
create policy "clubs can view registrations for their events"
  on public.registrations for select
  using (
    exists (
      select 1 from public.events
      where events.id = registrations.event_id
        and events.club_id = auth.uid()
    )
  );

-- 3. Students can cancel only their own registrations
create policy "students can cancel own registration"
  on public.registrations for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id and status = 'cancelled');

-- 4. Clubs can update registrations for their own events
create policy "clubs can update registrations for their events"
  on public.registrations for update
  using (
    exists (
      select 1 from public.events
      where events.id = registrations.event_id
        and events.club_id = auth.uid()
    )
  );

-- ─── RPC: Atomic Event Registration ─────────────────────────────────────────
create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_role user_role;
  v_event record;
  v_active_count int;
  v_existing record;
  v_ticket_code text;
  v_initial_status registration_status;
  v_issued_at timestamptz;
  v_reg_id uuid;
begin
  -- 1. Identify caller
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to register for an event.'
    );
  end if;

  -- 2. Verify caller role (Must be a student or platform admin)
  select role into v_user_role from public.profiles where id = v_user_id;
  if v_user_role not in ('student', 'platform_admin') then
    return jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Club organizer accounts cannot register as students for events.'
    );
  end if;

  -- 3. Concurrency lock on event row
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_FOUND',
      'message', 'Event could not be found.'
    );
  end if;

  -- 4. Verify event published
  if v_event.status != 'published' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_PUBLISHED',
      'message', 'This event is not currently published for public registration.'
    );
  end if;

  -- 5. Timing validations
  if now() >= v_event.start_date then
    return jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_ALREADY_STARTED',
      'message', 'Registration is closed because the event has already started.'
    );
  end if;

  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return jsonb_build_object(
      'success', false,
      'error_code', 'REGISTRATION_NOT_OPEN',
      'message', 'Registration for this event has not opened yet.'
    );
  end if;

  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    return jsonb_build_object(
      'success', false,
      'error_code', 'REGISTRATION_DEADLINE_PASSED',
      'message', 'The registration deadline for this event has passed.'
    );
  end if;

  -- 6. Check existing registration
  select * into v_existing
  from public.registrations
  where event_id = p_event_id and student_id = v_user_id;

  if found and v_existing.status != 'cancelled' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_REGISTERED',
      'message', 'You already have an active registration for this event.',
      'registration_id', v_existing.id,
      'ticket_code', v_existing.ticket_code,
      'status', v_existing.status
    );
  end if;

  -- 7. Enforce atomic capacity
  select count(*) into v_active_count
  from public.registrations
  where event_id = p_event_id and status in ('confirmed', 'pending_payment');

  if v_active_count >= v_event.capacity then
    return jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_REACHED',
      'message', 'This event has reached full capacity. No seats remaining.'
    );
  end if;

  -- 8. Generate opaque ticket code
  v_ticket_code := 'FF-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  -- Free events get instant confirmed tickets; Paid events start as pending_payment (Phase 5 handles payment verification)
  if v_event.is_free then
    v_initial_status := 'confirmed'::registration_status;
    v_issued_at := now();
  else
    v_initial_status := 'pending_payment'::registration_status;
    v_issued_at := null;
  end if;

  -- 9. Insert or re-activate
  if v_existing.id is not null then
    update public.registrations
    set ticket_code = v_ticket_code,
        status = v_initial_status,
        ticket_issued_at = v_issued_at,
        cancelled_at = null,
        created_at = now()
    where id = v_existing.id
    returning id into v_reg_id;
  else
    insert into public.registrations (event_id, student_id, ticket_code, status, ticket_issued_at)
    values (p_event_id, v_user_id, v_ticket_code, v_initial_status, v_issued_at)
    returning id into v_reg_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'ticket_code', v_ticket_code,
    'status', v_initial_status,
    'is_free', v_event.is_free,
    'ticket_issued', (v_issued_at is not null)
  );
end;
$$;

-- ─── RPC: Safe Registration Cancellation ────────────────────────────────────
create or replace function public.cancel_registration(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_reg record;
  v_event record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  end if;

  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
  end if;

  select * into v_event from public.events where id = v_reg.event_id;

  -- Caller must be student owner OR event club owner
  if v_reg.student_id != v_user_id and v_event.club_id != v_user_id then
    return jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You do not have permission to cancel this registration.');
  end if;

  if v_reg.status = 'cancelled' then
    return jsonb_build_object('success', true, 'message', 'Registration is already cancelled.');
  end if;

  update public.registrations
  set status = 'cancelled'::registration_status,
      cancelled_at = now()
  where id = p_registration_id;

  return jsonb_build_object('success', true, 'message', 'Registration cancelled successfully.');
end;
$$;
