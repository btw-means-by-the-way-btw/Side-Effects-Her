export function dateLabel(date: string): string { return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`)); }
export function today(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export const hydrationLabel = { less: "mniej niż zwykle", usual: "jak zwykle", more: "więcej niż zwykle", unsure: "nie jestem pewna" };
export const mealsLabel = { yes: "regularne", no: "nieregularne / pominięte", unsure: "nie jestem pewna" };
export const flowLabel = { light: "niewielkie", medium: "umiarkowane", heavy: "obfite", unsure: "nie jestem pewna" };
