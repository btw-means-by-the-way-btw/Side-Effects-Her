# SideEffectHer

Hackathon MVP with medication creation, baselines, persisted symptoms and timelines, server-side openFDA adapters, an evidence overview, optional confirmed AI symptom drafts, source-grounded label grouping, cycle context, accounts, daily dose plans, browser push, local prescription OCR and clinician PDF export.

This app does not diagnose, assess causation, estimate risk, or recommend medication changes.

## Run locally

1. Run `docker compose up -d db`. A fresh volume runs all six migrations in `supabase/migrations` automatically. For an older volume, apply any missing migrations in order: `20261003_cycle_context.sql`, `20261003_cycle_estimates.sql`, `20261003_accounts_daily.sql`, `20261004_checkin_meals.sql`, then `20261004_personal_patterns.sql`. Example: `Get-Content -Raw supabase/migrations/20261004_checkin_meals.sql | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U sideeffecther -d sideeffecther`. All six migrations are applied to the current local Docker database. Do not remove the named volume to upgrade.
2. Copy `.env.example` to `.env.local`. The default `DATABASE_URL` connects to the local Docker database on port 15432.
   Add a free `OPENFDA_API_KEY` in `.env.local` for higher openFDA request limits. The key stays on the server. Lookups can also run without a key at lower limits.
   To enable optional natural-language entry, add `OPENAI_API_KEY` to `.env.local` and restart the app. The manual form still works without this key. `OPENAI_SYMPTOM_MODEL` defaults to `gpt-4o-mini`.
   To enable grouping of exact phrases from openFDA drug labels, add `OPENROUTER_API_KEY` to `.env.local` and restart the app. `OPENROUTER_CLASSIFIER_MODEL` defaults to `deepseek/deepseek-v4.1-flash`. The model only proposes fixed category IDs and verbatim label phrases; local validation rejects unsupported proposals. The key stays server-side.
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Create an account at `/login`. During local development, the optional import checkbox attaches this browser's older journal to the account. Check it only for your own records. This compatibility import is disabled in production because the old workspace cookie was not authenticated.
6. For browser reminders, generate a VAPID pair with `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a contact `VAPID_SUBJECT` in `.env.local`, then run `npm run reminders` in a second process. The current local installation already has keys and a running worker. In `/schedule`, opt in to notifications on each device. HTTPS is required outside localhost. The worker must stay running; delivery also depends on browser and OS permissions. Some mobile browsers require installing the app or do not support push.

Stop the local database with `docker compose down`. Its named volume keeps saved entries for the next run.

To use hosted Supabase instead, run the same migration in its SQL editor and replace `DATABASE_URL` with a server-side PostgreSQL connection string. Keep that value private.

Run `npm run typecheck`, `npm test`, and `npm run build` to verify the project.

Accounts use salted scrypt passwords and expiring, opaque HTTP-only session cookies; only token hashes are stored. Private reads and writes use the authenticated account's workspace. Login attempts are limited and a password change revokes previous sessions. Each account has Polish/English, light/dark/system and time-zone settings. Email verification, password-reset email and account deletion are not implemented. This remains a local hackathon demo; production health-data operations need a separate deployment and privacy review.

## Current flow

The accepted editorial redesign is implemented in the live application. The medication dashboard (`/`), chronological history (`/timeline`), evidence overview (`/what-we-know`), cycle (`/cycle`), and symptom context (`/context`) use persisted data and server actions. On phones, four navigation tabs remain available at the bottom; entry forms open in accessible modal sheets. Local fonts, artwork, route transitions and subtle reveal effects support reduced-motion preferences. Medication names produce stable color hashes that rotate the existing pill artwork's hue. The static design preview remains at `/design/redesign-preview.html`. The account/daily-plan expansion requires `20261003_accounts_daily.sql`.

Development and production use separate build directories (`.next-dev` and `.next`) so a production build does not replace the running development server's files.

1. Save a medication name, dose, and start date.
2. Save one short baseline dated on or before the start date.
3. Press **Czuję zmianę** to save a symptom, severity (1–5), onset date, and optional note. After saving one symptom, optional context questions appear; they can be skipped.
4. Review the saved timeline. A symptom appearing after a medication start is a temporal observation, not evidence of causation.
5. Open **What do we know?** for four separate sections: your experience, official US label text, real-world report counts, and limitations.
6. Optionally describe symptoms in your own words. Review and edit each AI draft, choose any missing severity/date, then check the confirmation box to save.
7. In **Ostatnio u Ciebie**, choose **Jak się dziś czujesz?** to record a daily check-in. Mood or energy ratings 1–3 automatically reveal optional questions about water, regular meals and sleep. Higher ratings can also open these questions manually. Existing values for the selected date are loaded before editing. Saving returns to the medication dashboard and stores only the user's answers; no cause is selected and no LLM is used. The same form is available under **Cycle context**, alongside period records. Recorded cycle days and optional calendar illustrations remain separate from these observations.

Daily meal answers require `supabase/migrations/20261004_checkin_meals.sql` (already applied to the current local Docker database). Existing records receive a null value, not an inferred answer. Apply it after the four earlier migrations on existing deployments. It is mounted in `compose.yaml` for new databases. Meals also appear in cycle history and clinician PDF export.

## Phase 2 evidence adapter

- `GET /api/evidence/label?medication=ibuprofen` returns up to three matching openFDA Drug Label records, with source URLs, the dataset update date, and explicit limitations.
- `GET /api/evidence/events?medication=ibuprofen` returns the count of matching Drug Event reports, raw `patient.patientsex` buckets and `femaleReactions`: up to four exact `patient.reaction.reactionmeddrapt.exact` terms with report counts, filtered by `patient.patientsex:2`. Each optional breakdown has an independent available/missing/unavailable status and source query. These are report counts, never incidence or risk estimates. The reporting section emphasises available patient-sex information, compact rows, reaction terms and explicit limits; it does not display the overall total as a hero metric. A report may mention several drugs and reactions, so reaction counts are not mutually exclusive or proof of causality.
- `/dev/openfda?medication=ibuprofen` is a development-only page for inspecting the typed responses. It is unavailable in a production build.
- Responses use `ok`, `not_found`, `invalid_request`, or `unavailable`. The adapter caches successful lookups for six hours and not-found lookups for ten minutes in server memory. Partial event responses with an unavailable sex or reaction breakdown use the shorter ten-minute lifetime. Complete upstream failures are not cached. The cache resets when the server restarts.

The openFDA key is read only from `OPENFDA_API_KEY` on the server and is excluded from API responses and source URLs. The adapter projects source fields without an LLM or medical inference. Drug-name matching remains imperfect, labels can vary by product, and spontaneous reports do not establish causality. These endpoints are unauthenticated for the local MVP and have no application-level rate limiter; do not expose them as a public health service in their current form.

## Phase 3 evidence overview

`/what-we-know?med=<medication-id>` joins the selected medication's persisted timeline with the existing server-side openFDA lookups. It links to source searches and handles missing data or unavailable source responses. Report counts are presented only as numbers of submitted reports, never risk, probability, or incidence. Personal entries and external data remain visually separate. No new migration is required.

## Phase 4 optional symptom drafts

`POST /api/symptoms/parse` sends only the user's free-text description to OpenAI when the user requests a draft. It uses a strict JSON schema, disables response storage with `store: false`, validates the returned fields locally, and never writes to the database. The model has no access to medication details, the timeline, openFDA responses, or database tools. A draft stays in browser memory. The user can correct or remove candidates, must fill missing severity and onset dates, and must explicitly confirm before the server action saves the entries in one transaction. No new migration is required. Do not enter real patient information in this hackathon demo.

## Phase 5 label grouping and cycle context

After a medication is saved, the server requests matching openFDA label records and asks OpenRouter to map exact phrases from their `adverse_reactions` text to a small, versioned symptom vocabulary. The classifier never sees a user's symptom history or cycle entries. It returns schema-constrained JSON; the server accepts only exact source substrings that also match a local category rule. Results are stored with label ID and source link and refreshed after 24 hours. Missing labels or classification failures show an empty or unavailable state. The overview shows matching category wording as a text match only. Up to two returned labels and 16,000 characters per adverse-reaction section are sampled; coverage is incomplete and groupings can be wrong.

`/cycle` stores user-entered period start/end dates and optional daily mood, energy, sleep, hydration, and notes. `/context?event=<symptom-id>` records answers to fixed context prompts. The app counts days since a recorded period start and displays same-day observations beside symptoms. Recorded observations do not infer menstrual phase or ovulation. The separate optional calendar illustration has the explicit gates described below; the app never diagnoses, assesses causality, or rules out alternative causes. Database migration: [`supabase/migrations/20261003_cycle_context.sql`](supabase/migrations/20261003_cycle_context.sql).

## Accounts, daily plans, prescription drafts and PDF

- `/settings`: account display name, language, appearance, time zone, password change and sign-out. Personal statements stay verbatim. Polish readers can request clearly labelled auxiliary translations of public FDA safety text; the unchanged original remains available.
- `/schedule`: enter the prescribed dose and daily time yourself; add separate entries for multiple daily doses. Optional reminder time is independent from dose time. Pause or resume entries. `/` shows today's plan and persists reversible taken marks. It never supplies missed-dose instructions or invents dosing.
- `/api/push`: authenticated public-key/status lookup and same-origin subscription registration/removal. `public/reminders-sw.js` displays generic notifications without medication names or health details. `scripts/reminder-worker.mjs` checks every 30 seconds, uses account time zones, skips taken doses, claims each reminder at most once per day and retries delivery failures within a 15-minute window. This is a daily schedule MVP; weekly/PRN schedules and native alarm guarantees are not implemented.
- `/prescription`: choosing an image starts local Tesseract OCR with locally hosted Polish/English models and automatically fills the review form. Pasting/editing source text also rebuilds the draft. Images and complete OCR text stay on the device. The deterministic parser supports labelled names, adjacent name/strength/time lines and Polish electronic prescription blocks (`Przepisano`, `DS`). When strength is missing, an explicit DS instruction is copied literally into the dose field and marked for review; names are still populated when dose information is missing. Packaging amounts and issue dates are not treatment doses or start dates. Explicit labelled start dates and HH:MM dose times can be copied; hours are never inferred from “1x1” or “twice daily”. Review every field, supply missing details and explicitly confirm before a transaction saves medications and optional schedules. Any draft edit clears confirmation. Handwriting, complex tables and ambiguous instructions may require manual entry. Medication strength is not automatically the prescribed dose.
- `/summary` and authenticated `GET /api/summary/pdf`: download a paginated PDF containing all the account's saved medication timelines, bleeding, check-ins, context answers, schedules, dose marks and available verified source phrases. It excludes removed symptoms and treats estimates separately from observations. Source indexing is partial; the PDF does not reproduce every external FDA label or make medical conclusions.

The evidence layer uses a `DrugSafetySource` interface separate from user-history persistence so openFDA can later be complemented by EMA/EudraVigilance.

## Calendar illustration, context questions and readable labels

- `/cycle` has a day explorer with separately marked recorded bleeding and optional calendar ranges. A persisted user declaration enables estimates only for reported regular natural cycles. Unknown or affected contexts (including hormonal treatment) suppress them. Adding/changing a medication preserves the declaration and calendar ranges; a server-generated fingerprint enables a non-blocking reminder to update context if circumstances changed. The app does not classify medication effects on ovulation with an LLM.
- The four stage tiles distinguish recorded bleeding from calendar assumptions. With fewer than three completed intervals, a user-confirmed natural-cycle context plus a stated usual length (21–35 days) permits an initial illustration from one period; the stated length is widened by ±2 days, an arbitrary MVP uncertainty margin rather than a clinical confidence interval. With three completed intervals, the last six intervals provide the model. Available intervals outside 21–35 days or with a spread above seven days suppress estimates. These are display gates, not clinical criteria. No 28-day default is used; missing, variable or overdue records show insufficient information.
- The next-start range is based on shortest/longest recorded intervals. The possible ovulation range is 10–16 days before it, following NHS educational material. A broad illustrative possible fertility window extends seven days before the range and one day after. The calendar may be wrong or ovulation may not occur. It is not a validated fertility model, contraception, a pregnancy-planning tool, or a hormone measurement; no pregnancy percentages or safe-day labels are displayed.
- `/context` uses fixed recording questions, explains their purpose, and displays stored answers and same-day check-ins separately from general NHS information. It never ranks causes, confirms dehydration/PMS, excludes a medication, or supplies a diagnosis.
- FDA safety sections use prominent topic cards with explicitly labelled short source excerpts. Each card opens the complete source wording; each section also retains its original text. These excerpts are not comprehensive medical summaries. A prominent symptom-category browser and symptom-entry hint show verified exact phrases with source attribution and full context. Matching text does not establish a symptom's cause. No LLM summarises warnings or creates drug-safety facts.

Sources: [NHS cycle and ovulation](https://www.nhs.uk/conditions/periods/fertility-in-the-menstrual-cycle/), [NHS fertility-awareness limitations](https://www.nhs.uk/contraception/methods-of-contraception/natural-family-planning/), [NHS headaches](https://www.nhs.uk/symptoms/headaches/), [NHS premenstrual symptoms](https://www.nhs.uk/conditions/pre-menstrual-syndrome/).

Migration: `supabase/migrations/20261003_cycle_estimates.sql` adds the workspace-scoped `cycle_profiles` table. It is applied to the local Docker database. Tests cover estimation gates, ranges, source-text preservation and the existing API/AI validation.

## Personal reference and daily-life impact

`/my-normal?med=<medication-id>` (Moja norma) shows confirmed personal observations across the authenticated account's medications, grouped by conservative local symptom categories or otherwise exact normalized descriptions. The comparison uses the 28 calendar days before medication start and the first 28 days from that start, capped at today in the account time zone. Counts are distinct days with recorded entries, never symptom frequency or risk. Original severity, notes, medication context and the selected medication's baseline stay visible. Missing entries mean unknown, not symptom absence.

The date explorer shows recorded daily answers and, only for a user-confirmed natural cycle context, the same day number from preceding recorded bleeding starts. It skips dates falling beyond the next recorded start and gaps over day 35; this is not a measured phase, ovulation finding or explanation of symptoms. It uses the available last 24 period records and last 90 check-ins. No LLM or external medical inference is used.

Optional **To wpływa na moje życie** selections and a personal note are available in manual entry, each AI candidate's explicit confirmation form, and existing observations under `/context`. Unanswered (`null`) differs from an explicit no-impact answer. AI never infers these fields. Workspace-scoped writes persist the answers, and timeline, evidence overview, My normal and clinician PDF display them as the user's own report.

Apply `supabase/migrations/20261004_personal_patterns.sql` after the five previous migrations on existing databases. It is already applied to the current local Docker database and mounted sixth in `compose.yaml` for fresh volumes. Existing symptoms retain null impact fields.

## Interactive personal charts

`/charts` is available from the sidebar and mobile navigation. It reads authenticated personal history and renders a 7-, 30- or 90-day window with medication and symptom-description filters. Users can move through earlier windows, toggle symptom severity, mood/energy, sleep hours, recorded medication starts and recorded bleeding, and select a date by click, arrow keys or date input to read its original entries and daily-life impact.

Symptom and mood/energy scales are separate 1–5 axes. Sleep uses a separate 0–24 hour axis. Individual entries are not averaged or connected through missing days; unknown bleeding ends mark only the recorded start. Check-ins remain account-wide rather than being attributed to a medication. The view uses the available last 90 check-ins and last 24 period records, has no predictions, causal attribution or risk calculations, and requires no migration or new external service.

## Medication record corrections

Each medication on the home screen has an **Edit** button with prefilled name, recorded dose and start date. The authenticated server action updates only the account's own medication and its initial timeline event in one transaction. A start date earlier than an existing baseline is rejected. Recorded observations and dose schedules retain their separately entered values; schedules are managed in the daily plan. A name correction invalidates the medication's FDA phrase index, and background indexing checks the current name before saving to prevent an older lookup from restoring stale evidence. No migration is required.

The local database integration check uses synthetic fixtures that are rolled back: `node --env-file=.env.local --conditions=react-server --experimental-strip-types tests/medication-edit.integration.mjs`.

## Auxiliary Polish FDA translations

`POST /api/evidence/label/translate` requires an authenticated account and same-origin requests. It accepts only medication ID, matched FDA label ID and an allowed safety section. The server verifies medication ownership and retrieves the public original from openFDA; arbitrary client text is rejected. Only public source paragraphs are sent to OpenRouter, never personal history, medication IDs, symptoms or cycle data.

The isolated translator uses `OPENROUTER_API_KEY` and optional `OPENROUTER_TRANSLATION_MODEL` (default `deepseek/deepseek-v4.1-flash`). It translates literal headings and full section text, not medical summaries. Structured JSON is checked for exact segment IDs/order, missing segments, numbers, units, and basic preservation of negation/uncertainty. These mechanical checks cannot certify clinical accuracy. The UI labels results as automatic auxiliary translations, retains expandable originals, and falls back to the source if translation is unavailable. English mode uses the original and makes no translation requests.

Translations load when a section approaches the viewport. Successful results are cached for seven days in memory and `.cache/fda-translations`, keyed by exact original content, model and translation version. Failures are cached in memory for 30 seconds. Provider calls are queued, with two sections translating concurrently, and the endpoint permits 40 requests per account per hour. No database migration is required. Original FDA paragraphs are never overwritten. Mocked tests cover output validation, chunk preservation, provider failures, cache expiry/invalidation, and topic presentation.

Symptom quote disclosures also support Polish full-context translations. The same authenticated endpoint accepts an optional integer `paragraphIndex`, verified against the server-retrieved label section. It translates the entire selected source paragraph, with no inferred symptom-specific explanation or omitted qualifiers. Context translations load only after opening the disclosure; identical paragraph requests across symptom cards are deduplicated. The unchanged English paragraph is expandable below the labelled translation. Short exact quotes stay verbatim for source matching.
