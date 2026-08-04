-- ============================================================================
-- Intense Studio — Initial schema
-- ----------------------------------------------------------------------------
-- Change: supabase-database-setup (Slice 1 / PR 1)
-- Acceptance criteria: DB-REQ-1..DB-REQ-8 (openspec/specs/database-schema/spec.md)
-- Design: openspec/changes/supabase-database-setup/design.md
--
-- Design decisions encoded here:
--   1. Client-minted UUIDv4 TEXT PKs (offline-first — clients mint final IDs
--      before any network call; no server-side ID generation or remapping).
--   2. CHECK constraints instead of Postgres enums (string-typed codegen).
--   3. class_enrollments.day_of_week NOT NULL, part of the composite PK.
--   4. FK delete semantics: student -> CASCADE (payments, attendance,
--      enrollments); class -> CASCADE (enrollments), SET NULL (attendance).
--   5. RLS enabled on every table with permissive anon policies — documented
--      security debt: the publishable key acts as a bearer credential; no PII
--      is stored; tightening to owner_id tenancy is deferred.
--   6. Guard `set_updated_at` trigger stamps now() ONLY when the statement did
--      not supply updated_at (NEW.updated_at = OLD.updated_at), so offline sync
--      replay can override updated_at with the queue item timestamp (LWW).
--   8. Empty schema — no seed, no import (DB-REQ-8).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables (DB-REQ-1)
-- ----------------------------------------------------------------------------

-- students: registry of gym members.
-- Columns `status`, `last_payment_*` and `emergency_contact` are intentionally
-- NOT created (dropped by design; see design.md file-changes).
create table public.students (
  id                text primary key,
  name              text not null,
  phone             text not null,
  email             text,
  registration_date date not null,
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- class_schedules: recurring weekly classes. times are HH:MM (24h) TEXT.
-- days_of_week uses 1=Monday .. 7=Sunday (ISO numbering). The array must be
-- non-empty (a class without days can never render) and contain only 1..7.
create table public.class_schedules (
  id           text primary key,
  name         text not null,
  start_time   text not null
    constraint class_schedules_start_time_check
    check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time     text not null
    constraint class_schedules_end_time_check
    check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days_of_week smallint[] not null
    constraint class_schedules_days_of_week_check
    check (cardinality(days_of_week) > 0
       and days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  max_capacity integer not null
    constraint class_schedules_max_capacity_check
    check (max_capacity > 0),
  color         text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- payments: payment records with a snapshot of the student name so history
-- survives student edits. receipt_number UNIQUE so collisions fail loudly
-- (DB-REQ-7). payment_method CHECK instead of enum (DB-REQ-3).
create table public.payments (
  id             text primary key,
  student_id     text not null
    references public.students (id) on delete cascade,
  student_name   text not null,
  amount         integer not null
    constraint payments_amount_check
    check (amount > 0),
  payment_method text not null
    constraint payments_payment_method_check
    check (payment_method in ('efectivo', 'transferencia', 'debito', 'credito')),
  payment_date   date not null,
  notes          text,
  receipt_number text not null
    constraint payments_receipt_number_key unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- attendance_records: daily attendance with name snapshots (student_name,
-- class_name) so records stay readable after renames/deletes.
-- class_id is nullable: deleting a class keeps attendance and nulls class_id
-- (SET NULL — DB-REQ-4). Column `notes` is intentionally NOT created (dead).
create table public.attendance_records (
  id               text primary key,
  student_id       text not null
    references public.students (id) on delete cascade,
  student_name     text not null,
  class_id         text
    references public.class_schedules (id) on delete set null,
  class_name       text not null,
  date             date not null,
  time             text not null,
  recorded_offline boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- class_enrollments: junction with day-of-week granularity (DB-REQ-2).
-- day_of_week is NOT NULL and part of the composite PK, so a NULL day is
-- rejected by the constraint and one row exists per (class, student, day).
create table public.class_enrollments (
  class_id    text not null
    references public.class_schedules (id) on delete cascade,
  student_id  text not null
    references public.students (id) on delete cascade,
  day_of_week smallint not null
    constraint class_enrollments_day_of_week_check
    check (day_of_week between 1 and 7),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (class_id, student_id, day_of_week)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index payments_student_id_payment_date_idx
  on public.payments (student_id, payment_date);

create index attendance_records_student_id_date_idx
  on public.attendance_records (student_id, date);

create index attendance_records_date_class_id_idx
  on public.attendance_records (date, class_id);

create index class_enrollments_student_id_idx
  on public.class_enrollments (student_id);

-- ----------------------------------------------------------------------------
-- updated_at guard trigger (DB-REQ-5, design decision 6)
-- ----------------------------------------------------------------------------
-- Stamps updated_at = now() only when the write did not supply its own value
-- (NEW.updated_at = OLD.updated_at). Offline sync replay passes the queue item
-- timestamp, so replay values survive untouched (last-write-wins).
-- class_enrollments intentionally has NO trigger: its updated_at is only ever
-- set explicitly by sync replay upserts (design decision 6).
--
-- LWW CONTRACT (inherited by PR 4 — offline-sync): every sync replay executor
-- SHALL pass updated_at = queue_item.timestamp on CREATE_*/UPDATE_* actions.
-- The guard infers "replay" from value inequality, so an executor that omits
-- updated_at (or replays a value equal to the stored one) silently bumps it to
-- now() and corrupts LWW ordering. Sync tests must assert the timestamp
-- survives replay (DB-REQ-5 replay scenario).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- The trigger function is SECURITY INVOKER and only mutates the row being
-- written; it needs no PUBLIC execute privilege. Revoke the default to keep
-- the surface minimal.
revoke execute on function public.set_updated_at() from public;

create trigger set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.class_schedules
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security (DB-REQ-6)
-- ----------------------------------------------------------------------------
-- Permissive no-login posture: the anon role (publishable key) can read and
-- write every table. Documented security debt (design decision 5) — the key is
-- a bearer credential; tighten to owner_id tenancy when Auth is adopted.
-- Authenticated-role policies are intentionally NOT created yet: adding them
-- now would hand a future sign-in path a blanket USING (true) with zero review.
-- The future Auth PR must add authenticated policies deliberately. Policies use
-- the `TO <role>` clause — the deprecated `auth.role()` form is avoided.

alter table public.students enable row level security;
alter table public.class_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.class_enrollments enable row level security;

-- students
create policy anon_all on public.students
  for all to anon
  using (true) with check (true);

-- class_schedules
create policy anon_all on public.class_schedules
  for all to anon
  using (true) with check (true);

-- payments
create policy anon_all on public.payments
  for all to anon
  using (true) with check (true);

-- attendance_records
create policy anon_all on public.attendance_records
  for all to anon
  using (true) with check (true);

-- class_enrollments
create policy anon_all on public.class_enrollments
  for all to anon
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Data API exposure grants
-- ----------------------------------------------------------------------------
-- Supabase only exposes tables through the Data API (PostgREST) when the
-- calling role holds table privileges — grant explicitly (Supabase skill
-- checklist: "Exposing a Table to the Data API"). RLS remains the row-level
-- gate; these grants do not bypass it. Only `anon` is granted for now: no Auth
-- path exists, and `authenticated` grants arrive together with its policies.

grant usage on schema public to anon;
grant select, insert, update, delete
  on all tables in schema public
  to anon;
