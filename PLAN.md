# SideEffectHer — phase 1 plan

## Minimal folder structure

```text
src/app/                  Next.js page, styles, server actions, workspace cookie route
src/lib/                  PostgreSQL connection, models, validation, timeline shaping
supabase/migrations/      Versioned PostgreSQL schema
```

No API adapters or AI code are needed in this phase. Later evidence adapters should live behind a separate server-side interface and must never derive medical claims from the timeline.

## Database schema

All four tables have a generated UUID primary key, a `workspace_id` UUID that scopes this no-login demo, and a creation timestamp. Child tables use a composite foreign key to prevent linking a record to a medication in another workspace.

| Table | Phase 1 fields | Purpose |
| --- | --- | --- |
| `medications` | `name`, `dose`, `started_on` | Medication entered by the user. |
| `medication_events` | `medication_id`, `event_type`, `occurred_on`, `dose_snapshot` | Persisted start event. Future event types require a later migration. |
| `baseline_symptoms` | `medication_id`, `description`, `observed_on` | One short description of the user's pre-treatment state per medication. |
| `symptom_events` | `medication_id`, `symptom`, `severity` (1–5), `onset_on`, `note` | User-reported change; no causality assertion. |

## Technical risks

- No authentication means the browser cookie is only demo-level separation. Losing it loses access to that workspace; this is unsuitable for real patient data or public deployment.
- The server holds a PostgreSQL connection string. It must never be exposed to browser code or committed.
- Date-only values preserve what the user entered, but an onset date alone does not establish a medication link or causation.
- The local Docker database verifies phase 1; a hosted Supabase deployment remains unverified.
- openFDA availability, drug-name matching, report interpretation, and source attribution remain phase 2 risks. No evidence is displayed in phase 1.

## Implementation checklist

- [x] Inspect repository (empty).
- [x] Define minimal structure, schema, and risks.
- [x] Create Next.js TypeScript and Tailwind shell.
- [x] Add migration and typed models.
- [x] Create workspace cookie and server-only database access.
- [x] Implement medication creation, baseline, symptom entry, and persisted timeline.
- [x] Verify type checking, production build, local Docker database connection, and page response.
- [x] Stop before openFDA, AI, and doctor summary.
