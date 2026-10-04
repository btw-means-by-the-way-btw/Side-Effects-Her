export const LIFE_IMPACTS = [
  { id: "work_study", pl: "Praca lub nauka", en: "Work or study" },
  { id: "sleep", pl: "Sen", en: "Sleep" },
  { id: "activity", pl: "Aktywność", en: "Activity" },
  { id: "care", pl: "Opieka nad bliskimi", en: "Caring for loved ones" },
  { id: "intimacy", pl: "Życie intymne", en: "Intimacy" },
  { id: "other", pl: "Coś innego", en: "Something else" },
  { id: "none", pl: "Nie zauważyłam wpływu", en: "I noticed no impact" },
] as const;
export type LifeImpactId = typeof LIFE_IMPACTS[number]["id"];
export interface LifeImpact { lifeImpacts: LifeImpactId[] | null; impactNote: string | null }

/** These are explicit user answers, never inferred from symptom severity or AI drafts. */
export function readLifeImpact(data: FormData, suffix = ""): LifeImpact | null {
  const values = data.getAll(`life_impacts${suffix}`);
  const note = data.get(`impact_note${suffix}`);
  if (values.length > LIFE_IMPACTS.length || values.some(value => typeof value !== "string" || !LIFE_IMPACTS.some(option => option.id === value)) || new Set(values).size !== values.length) return null;
  if (values.includes("none") && values.length > 1) return null;
  if (note !== null && (typeof note !== "string" || note.trim().length > 500)) return null;
  return { lifeImpacts: values.length ? LIFE_IMPACTS.filter(option => values.includes(option.id)).map(option => option.id) : null, impactNote: typeof note === "string" ? note.trim() || null : null };
}

export function impactLabels(ids: LifeImpactId[] | null | undefined, locale: "pl" | "en"): string[] {
  return LIFE_IMPACTS.filter(option => ids?.includes(option.id)).map(option => option[locale]);
}
