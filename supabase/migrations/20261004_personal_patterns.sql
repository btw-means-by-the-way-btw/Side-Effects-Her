alter table public.symptom_events add column if not exists life_impacts text[]
  check (life_impacts is null or (
    life_impacts <@ array['work_study','sleep','activity','care','intimacy','other','none']::text[]
    and cardinality(life_impacts) between 1 and 7
    and array_position(life_impacts, null) is null
    and (not ('none' = any(life_impacts)) or cardinality(life_impacts) = 1)
  ));
alter table public.symptom_events add column if not exists impact_note text
  check (impact_note is null or length(impact_note) between 1 and 500);
-- Old entries remain unanswered. No impact is inferred or backfilled.
