import "server-only";
import postgres from "postgres";
import { createHash } from "node:crypto";
import type { CycleProfile } from "@/lib/models";
import type { BaselineSymptom, CycleCheckin, CyclePeriod, Medication, MedicationEvent, MedicationIndexState, MedicationSymptomSource, SymptomContextAnswer, SymptomEvent, TimelineItem } from "@/lib/models";
import { matchSymptomGroup } from "@/lib/symptom-groups";
import type { LifeImpact } from "./life-impact";
import type { PersonalObservation } from "./models";

type Sql = ReturnType<typeof postgres>;

export function medicationFingerprint(medications: Medication[]): string {
  return createHash("sha256").update(JSON.stringify([...medications].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name, dose, started_on }) => ({ id, name, dose, started_on })))).digest("hex");
}

export async function getCycleProfile(workspaceId: string): Promise<CycleProfile | null> {
  const rows = await db()<CycleProfile[]>`select mode, medication_fingerprint, confirmed_at::text, usual_length from public.cycle_profiles where workspace_id = ${workspaceId}`;
  return rows[0] ?? null;
}

export async function saveCycleProfile(workspaceId: string, mode: CycleProfile["mode"], fingerprint: string, usualLength: number | null = null): Promise<void> {
  await db()`insert into public.cycle_profiles (workspace_id, mode, medication_fingerprint, usual_length) values (${workspaceId}, ${mode}, ${fingerprint}, ${usualLength})
    on conflict (workspace_id) do update set mode = excluded.mode, medication_fingerprint = excluded.medication_fingerprint, usual_length = excluded.usual_length, confirmed_at = now()`;
}
const globalDb = globalThis as typeof globalThis & { sideEffectHerDb?: Sql };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): Sql {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  globalDb.sideEffectHerDb ??= postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    prepare: false,
  });
  return globalDb.sideEffectHerDb;
}

export async function listMedications(workspaceId: string): Promise<Medication[]> {
  const rows = await db()<Medication[]>`
    select id, workspace_id, name, dose, started_on::text
    from public.medications
    where workspace_id = ${workspaceId}
    order by created_at desc, id desc
  `;
  return [...rows];
}

export async function findMedication(workspaceId: string, medicationId: string): Promise<Medication | null> {
  const rows = await db()<Medication[]>`
    select id, workspace_id, name, dose, started_on::text
    from public.medications
    where workspace_id = ${workspaceId} and id = ${medicationId}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function createMedicationRecord(
  workspaceId: string,
  name: string,
  dose: string,
  startedOn: string,
): Promise<string> {
  return db().begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      insert into public.medications (workspace_id, name, dose, started_on)
      values (${workspaceId}, ${name}, ${dose}, ${startedOn})
      returning id
    `;
    const id = rows[0].id;
    await tx`
      insert into public.medication_events
        (workspace_id, medication_id, event_type, occurred_on, dose_snapshot)
      values (${workspaceId}, ${id}, 'started', ${startedOn}, ${dose})
    `;
    return id;
  });
}

export async function updateMedicationRecord(
  workspaceId: string,
  medicationId: string,
  name: string,
  dose: string,
  startedOn: string,
): Promise<"updated" | "not_found" | "baseline_conflict"> {
  return db().begin(async (tx) => {
    const existing = await tx<{ name: string }[]>`
      select name from public.medications
      where workspace_id = ${workspaceId} and id = ${medicationId} for update
    `;
    if (!existing.length) return "not_found";
    const baseline = await tx`
      select 1 from public.baseline_symptoms
      where workspace_id = ${workspaceId} and medication_id = ${medicationId}
        and observed_on > ${startedOn}::date limit 1
    `;
    if (baseline.length) return "baseline_conflict";
    await tx`
      update public.medications set name = ${name}, dose = ${dose}, started_on = ${startedOn}
      where workspace_id = ${workspaceId} and id = ${medicationId}
    `;
    await tx`
      update public.medication_events set occurred_on = ${startedOn}, dose_snapshot = ${dose}
      where workspace_id = ${workspaceId} and medication_id = ${medicationId} and event_type = 'started'
    `;
    if (existing[0].name !== name) {
      await tx`delete from public.medication_symptom_sources where workspace_id = ${workspaceId} and medication_id = ${medicationId}`;
      await tx`delete from public.medication_symptom_index_state where workspace_id = ${workspaceId} and medication_id = ${medicationId}`;
    }
    return "updated";
  });
}

export async function createBaselineRecord(
  workspaceId: string,
  medicationId: string,
  description: string,
  observedOn: string,
): Promise<void> {
  await db()`
    insert into public.baseline_symptoms (workspace_id, medication_id, description, observed_on)
    values (${workspaceId}, ${medicationId}, ${description}, ${observedOn})
  `;
}

export async function hasBaseline(workspaceId: string, medicationId: string): Promise<boolean> {
  const rows = await db()`
    select 1 from public.baseline_symptoms
    where workspace_id = ${workspaceId} and medication_id = ${medicationId}
    limit 1
  `;
  return rows.length > 0;
}

export async function createSymptomRecord(
  workspaceId: string,
  medicationId: string,
  symptom: string,
  severity: number,
  onsetOn: string,
  note: string | null,
  impact: LifeImpact = { lifeImpacts: null, impactNote: null },
): Promise<string> {
  const groupId = matchSymptomGroup(symptom);
  const sql = db();
  const rows = await sql<{ id: string }[]>`
    insert into public.symptom_events (workspace_id, medication_id, symptom, severity, onset_on, note, symptom_group_id, life_impacts, impact_note)
    values (${workspaceId}, ${medicationId}, ${symptom}, ${severity}, ${onsetOn}, ${note}, ${groupId}, ${impact.lifeImpacts ? sql.array(impact.lifeImpacts, 25) : null}, ${impact.impactNote})
    returning id
  `;
  return rows[0].id;
}

export async function createSymptomRecords(
  workspaceId: string,
  medicationId: string,
  candidates: Array<{ symptom: string; severity: number; onsetOn: string; note: string | null } & Partial<LifeImpact>>,
): Promise<string[]> {
  return db().begin(async (tx) => {
    const ids: string[] = [];
    for (const candidate of candidates) {
      const groupId = matchSymptomGroup(candidate.symptom);
      const rows = await tx<{ id: string }[]>`
        insert into public.symptom_events (workspace_id, medication_id, symptom, severity, onset_on, note, symptom_group_id, life_impacts, impact_note)
        values (${workspaceId}, ${medicationId}, ${candidate.symptom}, ${candidate.severity}, ${candidate.onsetOn}, ${candidate.note}, ${groupId}, ${candidate.lifeImpacts ? db().array(candidate.lifeImpacts, 25) : null}, ${candidate.impactNote ?? null})
        returning id
      `;
      ids.push(rows[0].id);
    }
    return ids;
  });
}

export async function getTimeline(workspaceId: string, medicationId: string): Promise<TimelineItem[]> {
  const sql = db();
  const [events, baselines, symptoms] = await Promise.all([
    sql<MedicationEvent[]>`
      select id, medication_id, event_type, occurred_on::text, dose_snapshot
      from public.medication_events
      where workspace_id = ${workspaceId} and medication_id = ${medicationId}
    `,
    sql<BaselineSymptom[]>`
      select id, medication_id, description, observed_on::text
      from public.baseline_symptoms
      where workspace_id = ${workspaceId} and medication_id = ${medicationId}
    `,
    sql<SymptomEvent[]>`
      select id, medication_id, symptom, severity, onset_on::text, note, symptom_group_id, life_impacts, impact_note
      from public.symptom_events
      where workspace_id = ${workspaceId} and medication_id = ${medicationId} and deleted_at is null
    `,
  ]);

  const items: TimelineItem[] = [
    ...baselines.map((row) => ({ kind: "baseline" as const, id: row.id, date: row.observed_on, description: row.description })),
    ...events.map((row) => ({ kind: "medication" as const, id: row.id, date: row.occurred_on, dose: row.dose_snapshot })),
    ...symptoms.map((row) => ({
      kind: "symptom" as const,
      id: row.id,
      date: row.onset_on,
      symptom: row.symptom,
      severity: row.severity,
      note: row.note,
      groupId: row.symptom_group_id ?? matchSymptomGroup(row.symptom),
      lifeImpacts: row.life_impacts,
      impactNote: row.impact_note,
    })),
  ];
  const order = { baseline: 0, medication: 1, symptom: 2 };
  return items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
}

export async function getMedicationSymptomIndex(workspaceId: string, medicationId: string): Promise<{ state: MedicationIndexState | null; sources: MedicationSymptomSource[] }> {
  const sql = db();
  const [states, sources] = await Promise.all([
    sql<MedicationIndexState[]>`select status, indexed_at::text, vocabulary_version from public.medication_symptom_index_state where workspace_id = ${workspaceId} and medication_id = ${medicationId}`,
    sql<MedicationSymptomSource[]>`select id, symptom_group_id, exact_phrase, label_id, label_effective_time, source_url from public.medication_symptom_sources where workspace_id = ${workspaceId} and medication_id = ${medicationId} order by symptom_group_id, exact_phrase`,
  ]);
  return { state: states[0] ?? null, sources: [...sources] };
}

export async function replaceMedicationSymptomIndex(
  workspaceId: string,
  medicationId: string,
  status: MedicationIndexState["status"],
  vocabularyVersion: number,
  sources: Array<Omit<MedicationSymptomSource, "id">>,
  expectedName?: string,
): Promise<void> {
  await db().begin(async (tx) => {
    // A lookup started before a rename must not attach the old drug's evidence.
    const medication = await tx<{ name: string }[]>`select name from public.medications where workspace_id = ${workspaceId} and id = ${medicationId} for update`;
    if (!medication.length || (expectedName !== undefined && medication[0].name !== expectedName)) return;
    await tx`delete from public.medication_symptom_sources where workspace_id = ${workspaceId} and medication_id = ${medicationId}`;
    for (const source of sources) {
      await tx`
        insert into public.medication_symptom_sources (workspace_id, medication_id, symptom_group_id, exact_phrase, label_id, label_effective_time, source_url, vocabulary_version)
        values (${workspaceId}, ${medicationId}, ${source.symptom_group_id}, ${source.exact_phrase}, ${source.label_id}, ${source.label_effective_time}, ${source.source_url}, ${vocabularyVersion})
        on conflict do nothing
      `;
    }
    await tx`
      insert into public.medication_symptom_index_state (workspace_id, medication_id, status, vocabulary_version)
      values (${workspaceId}, ${medicationId}, ${status}, ${vocabularyVersion})
      on conflict (medication_id) do update set status = excluded.status, vocabulary_version = excluded.vocabulary_version, indexed_at = now()
    `;
  });
}

export async function listCyclePeriods(workspaceId: string): Promise<CyclePeriod[]> {
  const rows = await db()<CyclePeriod[]>`
    select id, started_on::text, ended_on::text, flow, note
    from public.cycle_periods where workspace_id = ${workspaceId}
    order by started_on desc limit 24
  `;
  return [...rows];
}

export async function createCyclePeriodRecord(workspaceId: string, startedOn: string, endedOn: string | null, flow: CyclePeriod["flow"], note: string | null): Promise<void> {
  await db()`insert into public.cycle_periods (workspace_id, started_on, ended_on, flow, note) values (${workspaceId}, ${startedOn}, ${endedOn}, ${flow}, ${note})`;
}

export async function listCycleCheckins(workspaceId: string): Promise<CycleCheckin[]> {
  const rows = await db()<CycleCheckin[]>`
    select id, observed_on::text, mood, energy, sleep_hours::float8, hydration, meals_regular, note
    from public.cycle_checkins where workspace_id = ${workspaceId}
    order by observed_on desc limit 90
  `;
  return [...rows];
}

export async function saveCycleCheckinRecord(workspaceId: string, observedOn: string, mood: number | null, energy: number | null, sleepHours: number | null, hydration: CycleCheckin["hydration"], note: string | null, mealsRegular: CycleCheckin["meals_regular"] = null): Promise<void> {
  await db()`
    insert into public.cycle_checkins (workspace_id, observed_on, mood, energy, sleep_hours, hydration, meals_regular, note)
    values (${workspaceId}, ${observedOn}, ${mood}, ${energy}, ${sleepHours}, ${hydration}, ${mealsRegular}, ${note})
    on conflict (workspace_id, observed_on) do update set mood = excluded.mood, energy = excluded.energy, sleep_hours = excluded.sleep_hours, hydration = excluded.hydration, meals_regular = excluded.meals_regular, note = excluded.note
  `;
}

export async function findSymptomEvent(workspaceId: string, eventId: string): Promise<SymptomEvent | null> {
  const rows = await db()<SymptomEvent[]>`
    select id, medication_id, symptom, severity, onset_on::text, note, symptom_group_id, life_impacts, impact_note
    from public.symptom_events where workspace_id = ${workspaceId} and id = ${eventId} and deleted_at is null limit 1
  `;
  return rows[0] ?? null;
}

export async function saveLifeImpact(workspaceId: string, eventId: string, impact: LifeImpact): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    update public.symptom_events set life_impacts = ${impact.lifeImpacts ? sql.array(impact.lifeImpacts, 25) : null}, impact_note = ${impact.impactNote}
    where workspace_id = ${workspaceId} and id = ${eventId} and deleted_at is null returning id
  `;
  return rows.length === 1;
}

/** Only this account's observations, including entries recorded under another medication. */
export async function listPersonalObservations(workspaceId: string): Promise<PersonalObservation[]> {
  const rows = await db()<(SymptomEvent & { medication_name: string })[]>`
    select e.id, e.medication_id, e.symptom, e.severity, e.onset_on::text, e.note, e.symptom_group_id, e.life_impacts, e.impact_note, m.name as medication_name
    from public.symptom_events e join public.medications m on m.id = e.medication_id and m.workspace_id = e.workspace_id
    where e.workspace_id = ${workspaceId} and e.deleted_at is null order by e.onset_on, e.id
  `;
  return rows.map(row => ({ kind: "symptom", id: row.id, date: row.onset_on, symptom: row.symptom, severity: row.severity, note: row.note, groupId: row.symptom_group_id ?? matchSymptomGroup(row.symptom), lifeImpacts: row.life_impacts, impactNote: row.impact_note, medicationId: row.medication_id, medicationName: row.medication_name }));
}

export async function listSymptomContextAnswers(workspaceId: string, eventId: string): Promise<SymptomContextAnswer[]> {
  const rows = await db()<SymptomContextAnswer[]>`
    select question_id, answer from public.symptom_context_answers
    where workspace_id = ${workspaceId} and symptom_event_id = ${eventId}
  `;
  return [...rows];
}

export async function saveSymptomContextAnswers(workspaceId: string, eventId: string, answers: SymptomContextAnswer[]): Promise<void> {
  await db().begin(async (tx) => {
    await tx`delete from public.symptom_context_answers where workspace_id = ${workspaceId} and symptom_event_id = ${eventId}`;
    for (const item of answers) {
      await tx`
        insert into public.symptom_context_answers (workspace_id, symptom_event_id, question_id, answer)
        values (${workspaceId}, ${eventId}, ${item.question_id}, ${item.answer})
      `;
    }
  });
}
