// Run against the local test database:
// node --env-file=.env.local --conditions=react-server --experimental-strip-types tests/medication-edit.integration.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import postgres from 'postgres';

const source = await readFile(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
const transformed = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('@/lib/symptom-groups', '../src/lib/symptom-groups.ts');
await mkdir(new URL('../.run-logs/', import.meta.url), { recursive: true });
await writeFile(new URL('../.run-logs/medication-edit-db-under-test.mjs', import.meta.url), transformed);
const { updateMedicationRecord, replaceMedicationSymptomIndex } = await import('../.run-logs/medication-edit-db-under-test.mjs');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const workspace = randomUUID(), other = randomUUID(), rollback = new Error('rollback-fixtures');
try {
  await sql.begin(async tx => {
    globalThis.sideEffectHerDb = new Proxy(tx, {
      get(target, key) { return key === 'begin' ? callback => tx.savepoint(callback) : Reflect.get(target, key); },
    });
    const [med] = await tx`insert into medications (workspace_id,name,dose,started_on) values (${workspace},'Synthetic edit fixture','10 mg','2026-10-04') returning id`;
    await tx`insert into medication_events (workspace_id,medication_id,event_type,occurred_on,dose_snapshot) values (${workspace},${med.id},'started','2026-10-04','10 mg')`;
    await tx`insert into baseline_symptoms (workspace_id,medication_id,description,observed_on) values (${workspace},${med.id},'Synthetic baseline','2026-10-03')`;
    const [symptom] = await tx`insert into symptom_events (workspace_id,medication_id,symptom,severity,onset_on) values (${workspace},${med.id},'Synthetic observation',2,'2026-10-05') returning id`;
    await tx`insert into dose_schedules (workspace_id,medication_id,dose,take_time,starts_on) values (${workspace},${med.id},'10 mg','08:30','2026-10-04')`;
    await replaceMedicationSymptomIndex(workspace, med.id, 'empty', 1, [], 'Synthetic edit fixture');
    assert.equal(await updateMedicationRecord(other, med.id, 'Wrong account', '20 mg', '2026-10-05'), 'not_found');
    assert.equal(await updateMedicationRecord(workspace, med.id, 'Blocked date', '20 mg', '2026-10-02'), 'baseline_conflict');
    assert.equal((await tx`select name from medications where id=${med.id}`)[0].name, 'Synthetic edit fixture');
    assert.equal(await updateMedicationRecord(workspace, med.id, 'Renamed fixture', '20 mg', '2026-10-05'), 'updated');
    const [event] = await tx`select occurred_on::text,dose_snapshot from medication_events where medication_id=${med.id}`;
    assert.deepEqual(event, { occurred_on: '2026-10-05', dose_snapshot: '20 mg' });
    assert.equal((await tx`select count(*)::int as n from symptom_events where id=${symptom.id}`)[0].n, 1);
    assert.equal((await tx`select dose from dose_schedules where medication_id=${med.id}`)[0].dose, '10 mg');
    assert.equal((await tx`select count(*)::int as n from medication_symptom_index_state where medication_id=${med.id}`)[0].n, 0);
    await replaceMedicationSymptomIndex(workspace, med.id, 'empty', 1, [], 'Synthetic edit fixture');
    assert.equal((await tx`select count(*)::int as n from medication_symptom_index_state where medication_id=${med.id}`)[0].n, 0, 'Old-name lookups must not restore stale evidence');
    await replaceMedicationSymptomIndex(workspace, med.id, 'empty', 1, [], 'Renamed fixture');
    assert.equal((await tx`select count(*)::int as n from medication_symptom_index_state where medication_id=${med.id}`)[0].n, 1);
    assert.equal(await updateMedicationRecord(workspace, med.id, 'Renamed fixture', '30 mg', '2026-10-05'), 'updated');
    assert.equal((await tx`select count(*)::int as n from medication_symptom_index_state where medication_id=${med.id}`)[0].n, 1, 'Dose-only corrections retain evidence for the same medication name');
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  delete globalThis.sideEffectHerDb;
  await sql.end();
}
console.log('PASS: ownership, baseline chronology, persisted edits, unchanged observations/schedules, evidence invalidation and stale lookup guard. All fixtures rolled back.');
