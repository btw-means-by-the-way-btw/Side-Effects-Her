-- User-confirmed context gates optional calendar estimates. No hormone measurements or diagnoses.
create table if not exists public.cycle_profiles (
  workspace_id uuid primary key,
  mode text not null check (mode in ('unknown', 'natural', 'affected')),
  medication_fingerprint text not null,
  confirmed_at timestamptz not null default now()
);
alter table public.cycle_profiles enable row level security;
