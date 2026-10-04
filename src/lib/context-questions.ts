import type { SymptomGroupId } from "./symptom-groups";

export const CONTEXT_QUESTIONS = {
  water_less: "Czy tego dnia piłaś mniej wody niż zwykle?",
  sleep_changed: "Czy poprzedniej nocy spałaś inaczej niż zwykle?",
  bleeding_present: "Czy tego dnia występowało krwawienie?",
  meals_changed: "Czy tego dnia jadłaś o innych porach niż zwykle?",
  routine_changed: "Czy Twój dzień przebiegał inaczej niż zwykle?",
  activities_affected: "Czy ta zmiana wpłynęła na Twoje zwykłe aktywności?",
  stress_changed: "Czy tego dnia stres był większy niż zwykle?",
} as const;

export type ContextQuestionId = keyof typeof CONTEXT_QUESTIONS;

/** Fixed questions collect context. Answers are never used to exclude a cause. */
export function questionsForGroup(groupId: SymptomGroupId | null): ContextQuestionId[] {
  if (groupId === "headache") return ["water_less", "meals_changed", "sleep_changed", "stress_changed", "bleeding_present"];
  if (groupId === "dizziness") return ["water_less", "sleep_changed", "bleeding_present"];
  if (groupId === "nausea" || groupId === "abdominal_pain") return ["meals_changed", "bleeding_present", "activities_affected"];
  if (groupId === "mood_change" || groupId === "sleep_change" || groupId === "fatigue") return ["sleep_changed", "routine_changed", "bleeding_present"];
  return ["routine_changed", "bleeding_present", "activities_affected"];
}

export const CONTEXT_EXPLANATIONS: Record<ContextQuestionId, string> = {
  water_less: "Zapis porównuje picie wody z Twoim zwykłym dniem. Nie mierzy nawodnienia i nie ustala przyczyny objawu.",
  meals_changed: "Godziny posiłków pomagają opisać ten dzień. Sama odpowiedź nie potwierdza związku z objawem.",
  sleep_changed: "Sen jest częścią dziennego kontekstu. Zapisz zmianę bez przypisywania jej roli przyczyny.",
  stress_changed: "Twoja ocena stresu dodaje okoliczności, które możesz omówić z lekarzem.",
  bleeding_present: "To zaobserwowane krwawienie, nie potwierdzenie owulacji, fazy hormonalnej ani przyczyny objawu.",
  routine_changed: "Zmiana zwykłego planu dnia może być przydatna w rozmowie o Twoich obserwacjach.",
  activities_affected: "Wpływ na codzienne aktywności pomaga opisać znaczenie objawu własnymi słowami.",
};
