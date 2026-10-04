-- Additive: existing browser journals remain available for an explicit one-time import.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique,
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  display_name text not null check (length(display_name) between 1 and 80),
  locale text not null default 'pl' check (locale in ('pl','en')),
  theme text not null default 'light' check (theme in ('light','dark','system')),
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now()
);
create table if not exists public.account_sessions (
  token_hash text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists account_sessions_account_idx on public.account_sessions(account_id);
create table if not exists public.auth_attempts (
  key text primary key, attempts integer not null, reset_at timestamptz not null
);
alter table public.symptom_events add column if not exists deleted_at timestamptz;
alter table public.cycle_profiles add column if not exists usual_length smallint check (usual_length between 21 and 35);
create table if not exists public.dose_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  medication_id uuid not null,
  dose text not null check (length(trim(dose)) between 1 and 120),
  take_time time not null,
  remind_time time,
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(id,workspace_id),
  foreign key(medication_id,workspace_id) references public.medications(id,workspace_id) on delete cascade
);
create table if not exists public.dose_intakes (
  schedule_id uuid not null,
  workspace_id uuid not null,
  due_on date not null,
  taken_at timestamptz not null default now(),
  primary key(schedule_id,due_on),
  foreign key(schedule_id,workspace_id) references public.dose_schedules(id,workspace_id) on delete cascade
);
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.reminder_deliveries (
  schedule_id uuid not null references public.dose_schedules(id) on delete cascade,
  due_on date not null,
  delivered_at timestamptz not null default now(),
  primary key(schedule_id,due_on)
);
alter table public.accounts enable row level security;
alter table public.account_sessions enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.dose_schedules enable row level security;
alter table public.dose_intakes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;
