import type { CyclePeriod } from "./models";

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/** Count from an observed first bleeding day; never infer ovulation or a clinical phase. */
export function observedCycleDay(date: string, periods: Pick<CyclePeriod, "started_on" | "ended_on">[]): { day: number; startedOn: string; bleedingRecorded: boolean } | null {
  const latest = periods.filter((period) => period.started_on <= date).sort((a, b) => b.started_on.localeCompare(a.started_on))[0];
  if (!latest) return null;
  const day = dayNumber(date) - dayNumber(latest.started_on) + 1;
  if (day < 1 || day > 90) return null; // Old, incomplete logs should not produce a confident cycle label.
  return { day, startedOn: latest.started_on, bleedingRecorded: date === latest.started_on || (latest.ended_on !== null && date <= latest.ended_on) };
}

export function recordedCycleIntervals(periods: Pick<CyclePeriod, "started_on">[]): Array<{ startedOn: string; nextStartedOn: string; days: number }> {
  const sorted = [...periods].sort((a, b) => a.started_on.localeCompare(b.started_on));
  const intervals: Array<{ startedOn: string; nextStartedOn: string; days: number }> = [];
  for (let index = 0; index < sorted.length - 1; index++) {
    const days = dayNumber(sorted[index + 1].started_on) - dayNumber(sorted[index].started_on);
    if (days > 0) intervals.push({ startedOn: sorted[index].started_on, nextStartedOn: sorted[index + 1].started_on, days });
  }
  return intervals;
}
