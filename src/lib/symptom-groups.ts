/** Versioned grouping vocabulary. IDs are stable; labels and synonyms may improve over time. */
export const SYMPTOM_GROUP_VERSION = 1;

export const SYMPTOM_GROUPS = [
  { id: "headache", label: "Headache", labelPl: "Ból głowy" },
  { id: "nausea", label: "Nausea", labelPl: "Nudności" },
  { id: "dizziness", label: "Dizziness", labelPl: "Zawroty głowy" },
  { id: "fatigue", label: "Fatigue", labelPl: "Zmęczenie" },
  { id: "sleep_change", label: "Sleep changes", labelPl: "Zmiany snu" },
  { id: "mood_change", label: "Mood changes", labelPl: "Zmiany nastroju" },
  { id: "abdominal_pain", label: "Abdominal pain", labelPl: "Ból brzucha" },
  { id: "pelvic_pain", label: "Pelvic pain or cramps", labelPl: "Ból miednicy lub skurcze" },
  { id: "bleeding_change", label: "Bleeding changes", labelPl: "Zmiany krwawienia" },
  { id: "breast_discomfort", label: "Breast discomfort", labelPl: "Dyskomfort piersi" },
  { id: "skin_reaction", label: "Skin changes", labelPl: "Zmiany skórne" },
  { id: "bowel_change", label: "Bowel changes", labelPl: "Zmiany wypróżniania" },
  { id: "appetite_change", label: "Appetite changes", labelPl: "Zmiany apetytu" },
] as const;

export type SymptomGroupId = typeof SYMPTOM_GROUPS[number]["id"];

const PATTERNS: Record<SymptomGroupId, RegExp> = {
  headache: /\b(?:bol(?:e|u|i|ow)? glowy|migren\w*|headaches?|migraines?)\b/u,
  nausea: /\b(?:nudnos\w*|mdlos\w*|nausea|queasy|vomit\w*)\b/u,
  dizziness: /\b(?:zawrot\w* glowy|kreci mi sie w glowie|dizz\w*|vertigo|lightheaded\w*)\b/u,
  fatigue: /\b(?:zmecz\w*|oslab\w*|fatigue|tired\w*|weakness)\b/u,
  sleep_change: /\b(?:bezsenn\w*|sen|snu|spani\w*|insomnia|sleep\w*)\b/u,
  mood_change: /\b(?:nastroj\w*|rozdrazn\w*|irritab\w*|mood\w*)\b/u,
  abdominal_pain: /\b(?:bol(?:e|u|i|ow)? brzucha|abdominal pain|stomach pain|stomachache)\b/u,
  pelvic_pain: /\b(?:bol(?:e|u|i|ow)? (?:miednicy|podbrzusza)|skurcz\w*|pelvic pain|cramps?)\b/u,
  bleeding_change: /\b(?:krwawien\w*|plamien\w*|miesiaczk\w*|okres\w*|bleeding|spotting|menstrual\w*)\b/u,
  breast_discomfort: /\b(?:piers\w*|breast\w* tenderness|breast pain)\b/u,
  skin_reaction: /\b(?:wysypk\w*|swedzen\w*|skor\w*|rash|itch\w*|hives)\b/u,
  bowel_change: /\b(?:biegun\w*|zapar\w*|stolec|wyprozn\w*|diarrh\w*|constipat\w*)\b/u,
  appetite_change: /\b(?:apetyt\w*|laknien\w*|appetite)\b/u,
};

export function normalizeSymptomText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Conservative local matching. Ambiguous or unfamiliar wording stays unclassified. */
export function matchSymptomGroup(value: string): SymptomGroupId | null {
  const normalized = normalizeSymptomText(value);
  const matches = SYMPTOM_GROUPS.filter((group) => PATTERNS[group.id].test(normalized));
  return matches.length === 1 ? matches[0].id : null;
}

export function groupLabel(id: string | null, locale: "en" | "pl" = "en"): string | null {
  const group = SYMPTOM_GROUPS.find((entry) => entry.id === id);
  return group ? locale === "pl" ? group.labelPl : group.label : null;
}

export function isGroupId(value: unknown): value is SymptomGroupId {
  return typeof value === "string" && SYMPTOM_GROUPS.some((group) => group.id === value);
}
