import type { CyclePeriod, PersonalObservation } from "./models";
import { isGroupId, matchSymptomGroup, normalizeSymptomText } from "./symptom-groups.ts";
import { validIsoDate } from "./daily.ts";

export function observationKey(item: Pick<PersonalObservation, "groupId" | "symptom">): string {
  const group = isGroupId(item.groupId) ? item.groupId : matchSymptomGroup(item.symptom);
  return group ? `group:${group}` : `text:${normalizeSymptomText(item.symptom)}`;
}
export function addPatternDays(date: string, offset: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
const earlier = (a: string, b: string) => a < b ? a : b;
export function compareMedicationDays(items: PersonalObservation[], key: string, startedOn: string, today: string) {
  const beforeFrom = addPatternDays(startedOn, -28), beforeTo = earlier(addPatternDays(startedOn, -1), today);
  const afterFrom = startedOn, afterTo = earlier(addPatternDays(startedOn, 27), today);
  const matching = items.filter(item => validIsoDate(item.date) && item.date <= today && observationKey(item) === key);
  const before = matching.filter(item => item.date >= beforeFrom && item.date <= beforeTo);
  const after = matching.filter(item => item.date >= afterFrom && item.date <= afterTo);
  const priorHistory = matching.filter(item => item.date < startedOn);
  return { beforeFrom, beforeTo, afterFrom, afterTo, before, after, priorHistory,
    beforeDays: new Set(before.map(item => item.date)).size, afterDays: new Set(after.map(item => item.date)).size };
}

export type CycleDayComparison =
  | { status: "unavailable"; reason: "context" | "history" | "date" }
  | { status: "available"; day: number; referenceStart: string; dates: string[] };

/** Same recorded day number, never the same measured hormonal phase or ovulation. */
export function comparableCycleDays(date: string, periods: Pick<CyclePeriod, "started_on">[], mode: string, today: string): CycleDayComparison {
  if (!validIsoDate(date) || date > today) return { status: "unavailable", reason: "date" };
  if (mode !== "natural") return { status: "unavailable", reason: "context" };
  const starts = [...new Set(periods.map(period => period.started_on).filter(start => validIsoDate(start) && start <= date))].sort();
  const reference = starts.at(-1);
  if (!reference) return { status: "unavailable", reason: "history" };
  const offset = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${reference}T12:00:00Z`)) / 86_400_000);
  if (offset > 34 || starts.length < 2) return { status: "unavailable", reason: "history" };
  const dates = starts.slice(0, -1).map((start, index) => ({ target: addPatternDays(start, offset), nextStart: starts[index + 1] }))
    .filter(({ target, nextStart }) => target < nextStart && target < reference && target <= today).map(item => item.target).slice(-4).reverse();
  return dates.length ? { status: "available", day: offset + 1, referenceStart: reference, dates } : { status: "unavailable", reason: "history" };
}
