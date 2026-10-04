-- Apply after 20261003_initial.sql. Existing symptom rows remain valid.
alter table public.symptom_events add column if not exists symptom_group_id text;
alter table public.symptom_events add constraint symptom_group_id_valid check (
  symptom_group_id is null or symptom_group_id in (
    'headache','nausea','dizziness','fatigue','sleep_change','mood_change',
    'abdominal_pain','pelvic_pain','bleeding_change','breast_discomfort',
    'skin_reaction','bowel_change','appetite_change'
  )
);
alter table public.symptom_events add constraint symptom_events_id_workspace_unique unique (id, workspace_id);

create table public.medication_symptom_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  medication_id uuid not null,
  symptom_group_id text not null,
  exact_phrase text not null check (length(exact_phrase) between 2 and 160),
  label_id text not null,
  label_effective_time text,
  source_url text not null,
  vocabulary_version integer not null,
  indexed_at timestamptz not null default now(),
  foreign key (medication_id, workspace_id) references public.medications (id, workspace_id) on delete cascade,
  unique (medication_id, symptom_group_id, exact_phrase, label_id)
);
create index medication_symptom_sources_lookup_idx on public.medication_symptom_sources (workspace_id, medication_id, symptom_group_id);

create table public.medication_symptom_index_state (
  medication_id uuid primary key,
  workspace_id uuid not null,
  status text not null check (status in ('ready','empty','unavailable')),
  indexed_at timestamptz not null default now(),
  vocabulary_version integer not null,
  foreign key (medication_id, workspace_id) references public.medications (id, workspace_id) on delete cascade
);

create table public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  started_on date not null,
  ended_on date,
  flow text check (flow is null or flow in ('light','medium','heavy','unsure')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  unique (workspace_id, started_on)
);
create index cycle_periods_workspace_date_idx on public.cycle_periods (workspace_id, started_on desc);

create table public.cycle_checkins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  observed_on date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  hydration text check (hydration is null or hydration in ('less','usual','more','unsure')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (workspace_id, observed_on)
);
create index cycle_checkins_workspace_date_idx on public.cycle_checkins (workspace_id, observed_on desc);

create table public.symptom_context_answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  symptom_event_id uuid not null,
  question_id text not null,
  answer text not null check (answer in ('yes','no','unsure')),
  answered_at timestamptz not null default now(),
  foreign key (symptom_event_id, workspace_id) references public.symptom_events (id, workspace_id) on delete cascade,
  unique (symptom_event_id, question_id)
);

alter table public.medication_symptom_sources enable row level security;
alter table public.medication_symptom_index_state enable row level security;
alter table public.cycle_periods enable row level security;
alter table public.cycle_checkins enable row level security;
alter table public.symptom_context_answers enable row level security;
