"use server";

import { requireAccount, requireWorkspace } from "@/lib/auth";
import { localDate } from "@/lib/daily";
import { readMealsRegular } from "@/lib/checkin";
import { readLifeImpact } from "@/lib/life-impact";
import { saveLifeImpact } from "@/lib/db";
import { listMedications, medicationFingerprint, saveCycleProfile } from "@/lib/db";
import { today } from "@/lib/display";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createBaselineRecord, createCyclePeriodRecord, createMedicationRecord, createSymptomRecord, createSymptomRecords, findMedication, findSymptomEvent, hasBaseline, saveCycleCheckinRecord, saveSymptomContextAnswers } from "@/lib/db";
import { readConfirmedDraft } from "@/lib/symptom-draft/openai";
import { questionsForGroup } from "@/lib/context-questions";
import { isGroupId, matchSymptomGroup } from "@/lib/symptom-groups";
import { ensureMedicationSymptomIndex } from "@/lib/classification/medication-index";
import { openFdaSource } from "@/lib/evidence/server";
import { dateField, field, optionalField, UUID_PATTERN, uuidField } from "@/lib/validation";
import { updateMedicationRecord } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function workspaceId(): Promise<string> {
  return requireWorkspace();
}

function back(error: string, medicationId?: string): never {
  const params = new URLSearchParams({ error });
  if (medicationId) params.set("med", medicationId);
  redirect(`/?${params.toString()}`);
}

export async function createMedication(data: FormData): Promise<void> {
  const name = field(data, "name", 120);
  const dose = field(data, "dose", 120);
  const startedOn = dateField(data, "started_on");
  if (!name || !dose || !startedOn) back("Uzupełnij nazwę leku, dawkę i poprawną datę rozpoczęcia.");

  const id = await workspaceId();
  let medicationId: string;
  try {
    medicationId = await createMedicationRecord(id, name, dose, startedOn);
  } catch (error) {
    console.error("Medication save failed", error);
    back("Nie udało się zapisać leku. Spróbuj ponownie.");
  }
  after(async () => {
    try {
      const medication = await findMedication(id, medicationId);
      if (!medication) return;
      const labels = await openFdaSource().lookupLabels(medication.name);
      await ensureMedicationSymptomIndex(id, medication, labels);
    } catch (error) {
      console.error("Background label indexing failed", error);
    }
  });
  redirect(`/?med=${medicationId}&saved=medication`);
}

export async function updateMedication(data: FormData): Promise<void> {
  const medicationId = uuidField(data, "medication_id");
  const name = field(data, "name", 120);
  const dose = field(data, "dose", 120);
  const startedOn = dateField(data, "started_on");
  if (!medicationId || !name || !dose || !startedOn) back("Uzupełnij nazwę leku, dawkę i poprawną datę rozpoczęcia.", medicationId ?? undefined);
  const workspace = await workspaceId();
  let result: Awaited<ReturnType<typeof updateMedicationRecord>>;
  try {
    result = await updateMedicationRecord(workspace, medicationId, name, dose, startedOn);
  } catch (error) {
    console.error("Medication update failed", error);
    back("Nie udało się zaktualizować leku. Spróbuj ponownie.", medicationId);
  }
  if (result === "not_found") back("Nie znaleziono leku w tym dzienniku.");
  if (result === "baseline_conflict") back("Data rozpoczęcia nie może być wcześniejsza niż zapis samopoczucia sprzed leku.", medicationId);
  revalidatePath("/", "layout");
  after(async () => {
    try {
      const medication = await findMedication(workspace, medicationId);
      if (!medication) return;
      const labels = await openFdaSource().lookupLabels(medication.name);
      await ensureMedicationSymptomIndex(workspace, medication, labels);
    } catch (error) { console.error("Updated medication label indexing failed", error); }
  });
  redirect(`/?med=${medicationId}&saved=medication-updated`);
}

export async function createBaseline(data: FormData): Promise<void> {
  const medicationId = uuidField(data, "medication_id");
  const description = field(data, "description", 500);
  const observedOn = dateField(data, "observed_on");
  if (!medicationId || !description || !observedOn) back("Opisz samopoczucie przed lekiem i podaj poprawną datę.");

  const id = await workspaceId();
  const medication = await findMedication(id, medicationId);
  if (!medication) back("Nie znaleziono leku w tym dzienniku.");
  if (observedOn > medication.started_on) back("Data obserwacji sprzed leku nie może być późniejsza niż rozpoczęcie leczenia.", medicationId);
  if (await hasBaseline(id, medicationId)) back("Samopoczucie sprzed leku jest już zapisane.", medicationId);

  try {
    await createBaselineRecord(id, medicationId, description, observedOn);
  } catch (error) {
    console.error("Baseline save failed", error);
    back("Nie udało się zapisać samopoczucia. Spróbuj ponownie.", medicationId);
  }
  redirect(`/?med=${medicationId}&saved=baseline`);
}

export async function createSymptom(data: FormData): Promise<void> {
  const medicationId = uuidField(data, "medication_id");
  const symptom = field(data, "symptom", 120);
  const onsetOn = dateField(data, "onset_on");
  const note = optionalField(data, "note", 1000);
  const rawSeverity = data.get("severity");
  const severity = typeof rawSeverity === "string" && /^[1-5]$/.test(rawSeverity) ? Number(rawSeverity) : null;
  const impact = readLifeImpact(data);
  if (!medicationId || !symptom || !onsetOn || severity === null || note === undefined || !impact) {
    back("Podaj objaw, nasilenie od 1 do 5 i poprawną datę pojawienia się.", medicationId ?? undefined);
  }

  const id = await workspaceId();
  const medication = await findMedication(id, medicationId);
  if (!medication) back("Nie znaleziono leku w tym dzienniku.");
  if (!(await hasBaseline(id, medicationId))) back("Najpierw zapisz samopoczucie przed rozpoczęciem leku.", medicationId);

  let eventId: string;
  try {
    eventId = await createSymptomRecord(id, medicationId, symptom, severity, onsetOn, note, impact);
  } catch (error) {
    console.error("Symptom save failed", error);
    back("Nie udało się zapisać objawu. Spróbuj ponownie.", medicationId);
  }
  redirect(`/context?event=${eventId}&med=${medicationId}&created=1`);
}

export async function confirmParsedSymptoms(data: FormData): Promise<void> {
  const medicationId = uuidField(data, "medication_id");
  const candidates = readConfirmedDraft(data);
  if (!medicationId || !candidates) back("Sprawdź każdy objaw, nasilenie i datę, a następnie wyraźnie potwierdź zapis.", medicationId ?? undefined);

  const id = await workspaceId();
  const medication = await findMedication(id, medicationId);
  if (!medication) back("Nie znaleziono leku w tym dzienniku.");
  if (!(await hasBaseline(id, medicationId))) back("Najpierw zapisz samopoczucie przed rozpoczęciem leku.", medicationId);
  const impacts = candidates.map((_, index) => readLifeImpact(data, `_${index}`));
  if (impacts.some(impact => impact === null)) back("Sprawdź zaznaczony wpływ na codzienność i długość opisu.", medicationId);
  let eventIds: string[];
  try {
    eventIds = await createSymptomRecords(id, medicationId, candidates.map((candidate, index) => ({ ...candidate, ...impacts[index]! })));
  } catch (error) {
    console.error("Confirmed symptom save failed", error);
    back("Nie udało się zapisać potwierdzonych obserwacji. Spróbuj ponownie.", medicationId);
  }
  if (eventIds.length === 1) redirect(`/context?event=${eventIds[0]}&med=${medicationId}&created=1`);
  redirect(`/?med=${medicationId}&saved=symptom`);
}

function cycleBack(error: string): never {
  redirect(`/cycle?error=${encodeURIComponent(error)}`);
}

export async function recordCyclePeriod(data: FormData): Promise<void> {
  const startedOn = dateField(data, "started_on");
  const rawEnd = data.get("ended_on");
  const endedOn = rawEnd === "" ? null : dateField(data, "ended_on");
  const rawFlow = data.get("flow");
  const flow = rawFlow === "" ? null : rawFlow;
  const note = optionalField(data, "note", 500);
  if (!startedOn || startedOn > today() || (rawEnd !== "" && !endedOn) || (endedOn && (endedOn < startedOn || endedOn > today())) || ![null, "light", "medium", "heavy", "unsure"].includes(flow as string | null) || note === undefined) {
    cycleBack("Sprawdź datę początku, opcjonalną datę końca i zapis krwawienia.");
  }
  try {
    await createCyclePeriodRecord(await workspaceId(), startedOn, endedOn, flow as "light" | "medium" | "heavy" | "unsure" | null, note);
  } catch (error) {
    console.error("Period save failed", error);
    cycleBack("Nie udało się zapisać dat krwawienia. Sprawdź, czy początek nie jest już zapisany.");
  }
  const returnMed = uuidField(data, "return_medication_id");
  redirect(`/cycle?saved=period${returnMed ? `&med=${returnMed}` : ""}`);
}

export async function recordCycleCheckin(data: FormData): Promise<void> {
  const account = await requireAccount();
  const returnMed = uuidField(data, "return_medication_id");
  const route = data.get("return_to") === "home" ? "/" : "/cycle";
  const returnQuery = new URLSearchParams();
  if (returnMed) returnQuery.set("med", returnMed);
  function checkinBack(error: string): never {
    returnQuery.set("error", error);
    redirect(`${route}?${returnQuery}`);
  }
  const observedOn = dateField(data, "observed_on");
  const numeric = (name: string): number | null | undefined => {
    const value = data.get(name);
    if (value === "") return null;
    return typeof value === "string" && /^[1-5]$/.test(value) ? Number(value) : undefined;
  };
  const mood = numeric("mood");
  const energy = numeric("energy");
  const rawSleep = data.get("sleep_hours");
  const sleepHours = rawSleep === "" ? null : typeof rawSleep === "string" && /^\d{1,2}(?:\.\d)?$/.test(rawSleep) && Number(rawSleep) <= 24 ? Number(rawSleep) : undefined;
  const rawHydration = data.get("hydration");
  const hydration = rawHydration === "" ? null : rawHydration;
  const mealsRegular = readMealsRegular(data.get("meals_regular"));
  const note = optionalField(data, "note", 500);
  if (!observedOn || observedOn > localDate(account.timezone) || mood === undefined || energy === undefined || sleepHours === undefined || ![null, "less", "usual", "more", "unsure"].includes(hydration as string | null) || mealsRegular === undefined || note === undefined) checkinBack("Podaj poprawną datę i wartości zapisu samopoczucia.");
  if (mood === null && energy === null && sleepHours === null && hydration === null && mealsRegular === null && note === null) checkinBack("Dodaj przynajmniej jedną obserwację z tego dnia.");
  try {
    await saveCycleCheckinRecord(account.workspace_id, observedOn, mood, energy, sleepHours, hydration as "less" | "usual" | "more" | "unsure" | null, note, mealsRegular);
  } catch (error) {
    console.error("Cycle check-in save failed", error);
    checkinBack("Nie udało się zapisać zapisu samopoczucia. Spróbuj ponownie.");
  }
  returnQuery.set("saved", "checkin");
  redirect(`${route}?${returnQuery}`);
}

export async function recordSymptomContext(data: FormData): Promise<void> {
  const eventId = uuidField(data, "event_id");
  if (!eventId) redirect("/cycle?error=Invalid%20symptom%20entry.");
  const workspace = await workspaceId();
  const event = await findSymptomEvent(workspace, eventId);
  if (!event) redirect("/cycle?error=Symptom%20entry%20not%20found.");
  const groupId = isGroupId(event.symptom_group_id) ? event.symptom_group_id : matchSymptomGroup(event.symptom);
  const questionIds = questionsForGroup(groupId);
  if (questionIds.some((questionId) => !["", "yes", "no", "unsure"].includes(data.get(`answer_${questionId}`) as string))) redirect(`/context?event=${eventId}&error=${encodeURIComponent("Wybierz poprawną odpowiedź dla każdego pytania.")}`);
  const answers = questionIds.flatMap((questionId) => {
    const answer = data.get(`answer_${questionId}`);
    return answer === "yes" || answer === "no" || answer === "unsure" ? [{ question_id: questionId, answer: answer as "yes" | "no" | "unsure" }] : [];
  });
  try { await saveSymptomContextAnswers(workspace, eventId, answers); }
  catch (error) { console.error("Context answer save failed", error); redirect(`/context?event=${eventId}&error=${encodeURIComponent("Nie udało się zapisać odpowiedzi.")}`); }
  redirect(`/context?event=${eventId}&saved=1`);
}

export async function recordLifeImpact(data: FormData): Promise<void> {
  const workspace = await workspaceId(), eventId = uuidField(data, "event_id"), impact = readLifeImpact(data);
  if (!eventId) redirect("/context?error=Invalid%20observation");
  if (!impact) redirect(`/context?event=${eventId}&error=${encodeURIComponent("Sprawdź zaznaczony wpływ na codzienność i długość opisu.")}`);
  let saved: boolean;
  try {
    saved = await saveLifeImpact(workspace, eventId, impact);
  } catch {
    console.error("Life impact save failed");
    redirect(`/context?event=${eventId}&error=${encodeURIComponent("Nie udało się zapisać wpływu na codzienność.")}`);
  }
  if (!saved) redirect(`/context?event=${eventId}`);
  redirect(`/context?event=${eventId}&saved=impact`);
}

export async function recordCycleProfile(data: FormData): Promise<void> {
  const mode = data.get("mode");
  const rawLength = data.get("usual_length");
  const usualLength = rawLength === "" || rawLength === null ? null : /^\d{2}$/.test(String(rawLength)) && Number(rawLength)>=21 && Number(rawLength)<=35 ? Number(rawLength) : undefined;
  const returnMed = uuidField(data, "return_medication_id");
  const query = new URLSearchParams();
  if (returnMed) query.set("med", returnMed);
  if (usualLength === undefined || !["unknown", "natural", "affected"].includes(mode as string) || (mode === "natural" && data.get("natural_confirmed") !== "on")) {
    query.set("error", "Wybierz kontekst i potwierdź warunki, zanim włączysz szacunki.");
    redirect(`/cycle?${query}`);
  }
  try {
    const workspace = await workspaceId();
    const medications = await listMedications(workspace);
    await saveCycleProfile(workspace, mode as "unknown" | "natural" | "affected", medicationFingerprint(medications), usualLength);
  } catch (error) {
    console.error("Cycle profile save failed", error);
    query.set("error", "Nie udało się zapisać kontekstu cyklu. Spróbuj ponownie.");
    redirect(`/cycle?${query}`);
  }
  query.set("saved", "profile");
  redirect(`/cycle?${query}`);
}
