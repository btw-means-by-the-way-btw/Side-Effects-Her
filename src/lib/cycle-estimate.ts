import type { CyclePeriod } from "./models";
import { recordedCycleIntervals } from "./cycle-context.ts";

export type CycleMode = "unknown" | "natural" | "affected";
export type DateRange = { from: string; to: string };
export type CycleEstimate =
  | { status: "insufficient"; reason: "context" | "history" | "variable" | "stale" | "date" }
  | { status: "estimated"; startedOn: string; nextBleeding: DateRange; ovulation: DateRange; possibleFertileWindow: DateRange; intervalCount: number; shortest: number; longest: number; basis: "history" | "declared" };

export const CYCLE_SOURCES = {
  cycle: "https://www.nhs.uk/conditions/periods/fertility-in-the-menstrual-cycle/",
  fertility: "https://www.nhs.uk/contraception/methods-of-contraception/natural-family-planning/",
  wellbeing: "https://www.nhs.uk/conditions/pre-menstrual-syndrome/",
};

function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const milliseconds = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === date ? Math.floor(milliseconds / 86_400_000) : null;
}
function dateFromDay(day: number): string { return new Date(day * 86_400_000).toISOString().slice(0, 10); }

/** Calendar illustration, never a measured ovulation, hormone level, or contraceptive rule.
 * NHS: ovulation often occurs 10–16 days before the next period; sperm can survive up to 7 days.
 * Three recent intervals, 21–35 days and a spread <=7 days are conservative MVP display gates,
 * not clinical criteria. The next period may fall outside the historical range.
 */
export function estimateCycle(date: string, periods: Pick<CyclePeriod, "started_on" | "ended_on">[], mode: CycleMode, usualLength: number | null = null): CycleEstimate {
  const target = dayNumber(date);
  if (target === null || periods.some(period => dayNumber(period.started_on) === null || (period.ended_on !== null && (dayNumber(period.ended_on) === null || period.ended_on < period.started_on)))) return { status: "insufficient", reason: "date" };
  if (mode !== "natural") return { status: "insufficient", reason: "context" };
  // Medication-list changes do not erase the user's declaration or calendar history.
  // The explorer separately asks the user to update their context if circumstances changed.
  // No use of future observations to estimate a historical day.
  const relevant = [...periods].filter(period => period.started_on <= date).sort((a, b) => a.started_on.localeCompare(b.started_on));
  if (new Set(relevant.map(period => period.started_on)).size !== relevant.length) return { status: "insufficient", reason: "history" };
  const intervals = recordedCycleIntervals(relevant).slice(-6);
  const declared = intervals.length < 3;
  if (!relevant.length || (declared && (usualLength === null || !Number.isInteger(usualLength) || usualLength < 21 || usualLength > 35))) return { status: "insufficient", reason: "history" };
  if (intervals.some(item => item.days < 21 || item.days > 35)) return { status: "insufficient", reason: "variable" };
  // A user-entered usual length is a weaker assumption; widen it rather than silently using 28 days.
  const shortest = declared ? Math.min(usualLength! - 2,...intervals.map(item=>item.days)) : Math.min(...intervals.map(item => item.days));
  const longest = declared ? Math.max(usualLength! + 2,...intervals.map(item=>item.days)) : Math.max(...intervals.map(item => item.days));
  if ((!declared && (shortest < 21 || longest > 35)) || longest - shortest > 7) return { status: "insufficient", reason: "variable" };
  const latest = relevant.at(-1)!;
  const start = dayNumber(latest.started_on)!;
  if (target >= start + longest) return { status: "insufficient", reason: "stale" };
  const ovulationStart = start + shortest - 16, ovulationEnd = start + longest - 10;
  return {
    status: "estimated", startedOn: latest.started_on, intervalCount: intervals.length, shortest, longest, basis: declared ? "declared" : "history",
    nextBleeding: { from: dateFromDay(start + shortest), to: dateFromDay(start + longest) },
    ovulation: { from: dateFromDay(ovulationStart), to: dateFromDay(ovulationEnd) },
    // Broad illustrative union, including one extra day after the latest estimated ovulation.
    possibleFertileWindow: { from: dateFromDay(Math.max(start, ovulationStart - 7)), to: dateFromDay(ovulationEnd + 1) },
  };
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";
/** Menstrual is an observed record, and overlaps the physiological follicular phase. */
export function cyclePhase(date:string, periods:Pick<CyclePeriod,"started_on"|"ended_on">[], estimate:CycleEstimate):CyclePhase|null {
  if(periods.some(period=>period.started_on<=date && (period.ended_on ? date<=period.ended_on : date===period.started_on)))return "menstrual";
  if(estimate.status!=="estimated")return null;
  const stage=calendarStage(date,estimate);return stage==="uncertain"?"ovulation":stage;
}

export function calendarStage(date: string, estimate: Extract<CycleEstimate, { status: "estimated" }>): "follicular" | "uncertain" | "luteal" {
  return date < estimate.ovulation.from ? "follicular" : date <= estimate.ovulation.to ? "uncertain" : "luteal";
}

export const ESTIMATE_REASONS: Record<Extract<CycleEstimate, { status: "insufficient" }>["reason"], string> = {
  context: "Najpierw określ kontekst cyklu. Przy lekach hormonalnych, ciąży, karmieniu, połogu, perimenopauzie lub niepewności pokazujemy tylko Twoje zapisy.",
  history: "Dodaj początek miesiączki i podaj swoją zwykłą długość cyklu w kontekście poniżej. Bez niej potrzebujemy czterech początków miesiączki. Nie podstawiamy domyślnych 28 dni.",
  variable: "Historia ma duże odstępy lub zmienność. Ten prosty model nie daje użytecznego szacunku; nadal możesz śledzić własne obserwacje.",
  stale: "Minął zakres wynikający z dotychczasowych odstępów. Nie przesuwamy cyklu automatycznie. Dodaj kolejny zaobserwowany początek miesiączki.",
  date: "Nie można obliczyć szacunku dla tych dat. Sprawdź zapisy cyklu.",
};
