/** Product prompt threshold only. It does not classify illness, causes or urgency. */
export function shouldAskDailyContext(mood: number | null, energy: number | null): boolean {
  return [mood, energy].some(score => score !== null && Number.isInteger(score) && score >= 1 && score <= 3);
}

export function readMealsRegular(value: unknown): "yes" | "no" | "unsure" | null | undefined {
  if (value === "" || value === null) return null;
  return value === "yes" || value === "no" || value === "unsure" ? value : undefined;
}
