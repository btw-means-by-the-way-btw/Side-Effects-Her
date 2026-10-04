import "server-only";
import { getMedicationSymptomIndex, replaceMedicationSymptomIndex } from "@/lib/db";
import { createOpenRouterLabelClassifier } from "@/lib/classification/openrouter";
import type { DrugLabelData, EvidenceLookup } from "@/lib/evidence/types";
import type { Medication, MedicationIndexState, MedicationSymptomSource } from "@/lib/models";
import { SYMPTOM_GROUP_VERSION } from "@/lib/symptom-groups";

export interface MedicationSymptomIndex {
  state: MedicationIndexState | null;
  sources: MedicationSymptomSource[];
}

function fresh(state: MedicationIndexState | null): boolean {
  if (!state || state.vocabulary_version !== SYMPTOM_GROUP_VERSION) return false;
  const age = Date.now() - new Date(state.indexed_at).getTime();
  return Number.isFinite(age) && age >= 0 && age < (state.status === "unavailable" ? 10 * 60_000 : 24 * 60 * 60_000);
}

export async function ensureMedicationSymptomIndex(
  workspaceId: string,
  medication: Medication,
  labels: EvidenceLookup<DrugLabelData>,
): Promise<MedicationSymptomIndex> {
  const existing = await getMedicationSymptomIndex(workspaceId, medication.id);
  if (fresh(existing.state)) return existing;

  if (labels.status !== "ok") {
    const status = labels.status === "not_found" ? "empty" : "unavailable";
    await replaceMedicationSymptomIndex(workspaceId, medication.id, status, SYMPTOM_GROUP_VERSION, [], medication.name);
    return getMedicationSymptomIndex(workspaceId, medication.id);
  }
  const classifier = createOpenRouterLabelClassifier({
    apiKey: process.env.OPENROUTER_API_KEY?.trim(),
    model: process.env.OPENROUTER_CLASSIFIER_MODEL?.trim() || undefined,
  });
  const selected = labels.data.labels.filter((label) => label.adverseReactions.length > 0).slice(0, 2).map((label) => ({
    label,
    sourceText: label.adverseReactions.join("\n\n").slice(0, 16_000),
  })).filter((item) => item.sourceText.trim());
  if (!selected.length) {
    await replaceMedicationSymptomIndex(workspaceId, medication.id, "empty", SYMPTOM_GROUP_VERSION, [], medication.name);
    return getMedicationSymptomIndex(workspaceId, medication.id);
  }

  const results = await Promise.all(selected.map(async ({ label, sourceText }) => ({ label, result: await classifier.classify(sourceText) })));
  const successful = results.filter((item) => item.result.status === "ok");
  if (!successful.length) {
    await replaceMedicationSymptomIndex(workspaceId, medication.id, "unavailable", SYMPTOM_GROUP_VERSION, [], medication.name);
    return getMedicationSymptomIndex(workspaceId, medication.id);
  }
  const sourceUrl = labels.sourceUrls.at(-1) ?? "https://open.fda.gov/apis/drug/label/";
  const sources = successful.flatMap(({ label, result }) => result.phrases.map((phrase) => ({
    symptom_group_id: phrase.groupId,
    exact_phrase: phrase.exactPhrase,
    label_id: label.id,
    label_effective_time: label.effectiveTime,
    source_url: sourceUrl,
  })));
  await replaceMedicationSymptomIndex(workspaceId, medication.id, sources.length ? "ready" : "empty", SYMPTOM_GROUP_VERSION, sources, medication.name);
  return getMedicationSymptomIndex(workspaceId, medication.id);
}
