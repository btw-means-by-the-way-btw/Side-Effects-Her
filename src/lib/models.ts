import type { LifeImpactId } from "./life-impact";

export interface Medication {
  id: string;
  workspace_id: string;
  name: string;
  dose: string;
  started_on: string;
}

export interface MedicationEvent {
  id: string;
  medication_id: string;
  event_type: "started";
  occurred_on: string;
  dose_snapshot: string;
}

export interface BaselineSymptom {
  id: string;
  medication_id: string;
  description: string;
  observed_on: string;
}

export interface SymptomEvent {
  id: string;
  medication_id: string;
  symptom: string;
  severity: number;
  onset_on: string;
  note: string | null;
  symptom_group_id: string | null;
  life_impacts: LifeImpactId[] | null;
  impact_note: string | null;
}

export interface CyclePeriod {
  id: string;
  started_on: string;
  ended_on: string | null;
  flow: "light" | "medium" | "heavy" | "unsure" | null;
  note: string | null;
}

export interface CycleCheckin {
  id: string;
  observed_on: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  hydration: "less" | "usual" | "more" | "unsure" | null;
  meals_regular: "yes" | "no" | "unsure" | null;
  note: string | null;
}

export interface CycleProfile {
  mode: "unknown" | "natural" | "affected";
  medication_fingerprint: string;
  confirmed_at: string;
  usual_length: number | null;
}

export interface MedicationSymptomSource {
  id: string;
  symptom_group_id: string;
  exact_phrase: string;
  label_id: string;
  label_effective_time: string | null;
  source_url: string;
}

export interface MedicationIndexState {
  status: "ready" | "empty" | "unavailable";
  indexed_at: string;
  vocabulary_version: number;
}

export interface SymptomContextAnswer {
  question_id: string;
  answer: "yes" | "no" | "unsure";
}

export type TimelineItem =
  | { kind: "baseline"; id: string; date: string; description: string }
  | { kind: "medication"; id: string; date: string; dose: string }
  | { kind: "symptom"; id: string; date: string; symptom: string; severity: number; note: string | null; groupId: string | null; lifeImpacts: LifeImpactId[] | null; impactNote: string | null };

export interface PersonalObservation extends Extract<TimelineItem, { kind: "symptom" }> {
  medicationId: string;
  medicationName: string;
}
