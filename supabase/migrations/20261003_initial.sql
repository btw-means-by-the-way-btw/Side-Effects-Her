-- Run in the Supabase SQL editor before starting the app.
create extension if not exists pgcrypto;

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  dose text not null check (length(trim(dose)) between 1 and 120),
  started_on date not null,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.medication_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  medication_id uuid not null,
  event_type text not null check (event_type = 'started'),
  occurred_on date not null,
  dose_snapshot text not null,
  created_at timestamptz not null default now(),
  foreign key (medication_id, workspace_id)
    references public.medications (id, workspace_id) on delete cascade
);

create table public.baseline_symptoms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  medication_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 500),
  observed_on date not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, medication_id),
  foreign key (medication_id, workspace_id)
    references public.medications (id, workspace_id) on delete cascade
);

create table public.symptom_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  medication_id uuid not null,
  symptom text not null check (length(trim(symptom)) between 1 and 120),
  severity smallint not null check (severity between 1 and 5),
  onset_on date not null,
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (medication_id, workspace_id)
    references public.medications (id, workspace_id) on delete cascade
);

create index medications_workspace_idx on public.medications (workspace_id, created_at desc);
create index medication_events_timeline_idx on public.medication_events (workspace_id, medication_id, occurred_on);
create index baseline_symptoms_timeline_idx on public.baseline_symptoms (workspace_id, medication_id, observed_on);
create index symptom_events_timeline_idx on public.symptom_events (workspace_id, medication_id, onset_on);

-- Browser clients have no direct table access. Only the server connection reads/writes.
alter table public.medications enable row level security;
alter table public.medication_events enable row level security;
alter table public.baseline_symptoms enable row level security;
alter table public.symptom_events enable row level security;
