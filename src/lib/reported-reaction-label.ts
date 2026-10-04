// Exact display translations only. Source terms and report counts stay unchanged.
const POLISH_REACTION_LABELS: Readonly<Record<string, string>> = {
  "OVARIAN HYPERSTIMULATION SYNDROME": "Zespół hiperstymulacji jajników",
  "DRUG INEFFECTIVE": "Brak skuteczności leku",
  "INJECTION SITE PAIN": "Ból w miejscu wstrzyknięcia",
  "HEADACHE": "Ból głowy",
  "NAUSEA": "Nudności",
  "VOMITING": "Wymioty",
  "DIZZINESS": "Zawroty głowy",
  "FATIGUE": "Zmęczenie",
  "ABDOMINAL PAIN": "Ból brzucha",
  "DIARRHOEA": "Biegunka",
  "CONSTIPATION": "Zaparcie",
  "RASH": "Wysypka",
  "PRURITUS": "Świąd",
  "INSOMNIA": "Bezsenność",
};

export function reportedReactionLabel(term: string, locale: "pl" | "en"): { label: string; translated: boolean } {
  if (locale === "en") return { label: term, translated: false };
  const key = term.trim().replace(/\s+/g, " ").toUpperCase();
  const label = Object.hasOwn(POLISH_REACTION_LABELS, key) ? POLISH_REACTION_LABELS[key] : undefined;
  return { label: label ?? term, translated: label !== undefined };
}
