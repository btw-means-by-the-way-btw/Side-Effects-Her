# Phase 5: symptom groups and cycle context

## Product boundary

SideEffectHer remains a record and evidence comparison tool. It does not diagnose, rule out causes, estimate medication risk, or recommend treatment changes. A context question records an answer for a clinician; it cannot eliminate an explanation. The interface says "recorded near" rather than "caused by".

## Data flow

1. A medication is saved as today. The server looks up matching openFDA Drug Label records. Only `adverse_reactions` text is eligible for the symptom index; if a label or section is absent, the index shows insufficient information.
2. A classification adapter receives public label text and a versioned list of allowed symptom group IDs. Its output is schema validated. Each extracted phrase must be an exact substring of a returned label section. The database stores group ID, exact phrase, label ID, label date, and source URL. It never stores an unverified drug-safety claim from a model.
3. User symptom wording is normalized locally first (for example, "ból głowy", "bóle głowy", and "headaches" map to `headache`). Unknown or ambiguous wording remains unclassified; it is never forced into a group. Personal symptom text is not sent to OpenRouter in this phase.
4. A match means only that a user's group and a label-derived group share the same controlled ID. The page shows both the original user wording and the exact label phrase/source, with no causality statement.
5. Period start/end dates and optional daily mood, energy, sleep, and hydration check-ins are stored in the user's workspace. A cycle day is counted from an observed period start. No ovulation or fertile-window prediction is made from a generic 28-day model. Missing and irregular records remain visible as uncertainty.
6. A small, fixed set of context questions can be chosen by group. The questions ask about timing and recorded factors (for example sleep or hydration). Answers appear alongside the timeline for clinician discussion. They do not score, exclude, or diagnose causes.

## Stable symptom vocabulary

Use versioned IDs such as `headache`, `nausea`, `dizziness`, `fatigue`, `sleep_change`, `mood_change`, `abdominal_pain`, `pelvic_pain`, `bleeding_change`, `breast_discomfort`, `skin_reaction`, `bowel_change`, and `appetite_change`. Display labels may be translated without changing IDs. Exact synonyms and Unicode normalization run before any model call. Model output is restricted to this ID list and is checked again in code.

## Schema and persistence

- `medication_symptom_sources`: medication ID, group ID, exact source phrase, openFDA label ID and effective date, source URL, extraction version, extracted timestamp. Public source provenance remains attached to every row. `medication_symptom_index_state` stores refresh state.
- `cycle_periods`: workspace ID, start date, optional end date and flow.
- `cycle_checkins`: workspace ID, date, optional mood/energy/sleep/hydration values.
- `symptom_context_answers`: symptom event ID, question ID, answer and date.
- `symptom_events.symptom_group_id`: nullable group ID. Existing records remain valid; later matching can backfill without rewriting the user's wording.

## Reliability and privacy gates

- OpenRouter key is server only in ignored `.env.local`; never sent to the browser. Use the requested `deepseek/deepseek-v4.1-flash`, strict JSON schema, `require_parameters: true`, short timeouts, and local schema validation. If structured output is unsupported or malformed, mark classification unavailable; do not guess.
- Keep a bounded label-text input and disclose that the selected labels/sections are not exhaustive. Cache the per-medication index for 24 hours and invalidate it when the vocabulary version changes. Never send the user's full timeline or cycle history to the classifier.
- Do not run personal-text LLM requests implicitly. Disclose the provider and request explicit action before sending symptom wording.
- Tests cover Polish variants, refusal/unknown groups, mismatched source quotes, missing openFDA data, variable cycle lengths, and the absence of diagnosis or causality fields.

## Demo view

A new "Cycle context" area sits alongside the medication timeline. For a selected symptom it shows the original wording, a matched group when recognized, the day relative to a recorded period start, user-entered mood/energy/sleep/hydration, and context questions. The evidence overview shows exact label phrases in their own sourced section.

## Evidence behind the design

OpenRouter documents the [model](https://openrouter.ai/deepseek/deepseek-v4.1-flash) and [structured output routing](https://openrouter.ai/docs/guides/features/structured-outputs). ACOG explains [cycle counting from the first bleeding day](https://www.acog.org/womens-health/faqs/your-first-period) and that [cycle length varies](https://www.acog.org/womens-health/faqs/amenorrhea-absence-of-periods). The interface therefore uses observed dates rather than a universal phase prediction.
