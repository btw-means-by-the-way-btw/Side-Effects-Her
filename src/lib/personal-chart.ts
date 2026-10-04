import type { CycleCheckin, CyclePeriod, Medication, PersonalObservation } from "./models";
import { addPatternDays, observationKey } from "./personal-pattern.ts";
import { validIsoDate } from "./daily.ts";

export interface ChartDay {
  date: string;
  symptoms: PersonalObservation[];
  medicationStarts: Medication[];
  checkin: CycleCheckin | null;
  bleeding: CyclePeriod[];
}

/** Every day remains distinct; missing entries never become zero or an interpolated value. */
export function buildChartDays(from: string, to: string, observations: PersonalObservation[], medications: Medication[], checkins: CycleCheckin[], periods: CyclePeriod[], medicationId = "", symptomKey = ""): ChartDay[] {
  if (!validIsoDate(from) || !validIsoDate(to) || from > to) throw new RangeError("Invalid chart interval");
  const length = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
  if (length > 90) throw new RangeError("Chart interval exceeds 90 days");
  const selected = observations.filter(item => (!medicationId || item.medicationId === medicationId) && (!symptomKey || observationKey(item) === symptomKey));
  return Array.from({ length }, (_, index) => {
    const date = addPatternDays(from, index);
    return {
      date,
      symptoms: selected.filter(item => item.date === date),
      medicationStarts: medications.filter(med => med.started_on === date && (!medicationId || med.id === medicationId)),
      checkin: checkins.find(item => item.observed_on === date) ?? null,
      // An unrecorded end marks only the known start, never an invented bleeding duration.
      bleeding: periods.filter(period => period.started_on === date || (period.ended_on !== null && period.started_on <= date && period.ended_on >= date)),
    };
  });
}

export function chartWindow(to: string, length: number, today: string) {
  if (!validIsoDate(to) || to > today || ![7, 30, 90].includes(length)) return null;
  return { from: addPatternDays(to, 1 - length), to };
}

export function recordedRating(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}
