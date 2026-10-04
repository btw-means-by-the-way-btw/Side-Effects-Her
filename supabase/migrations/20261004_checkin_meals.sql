-- Optional self-reported context; not a nutritional assessment.
alter table public.cycle_checkins add column if not exists meals_regular text
  check (meals_regular is null or meals_regular in ('yes', 'no', 'unsure'));
