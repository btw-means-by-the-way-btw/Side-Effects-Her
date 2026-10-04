export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function field(data: FormData, name: string, maxLength: number): string | null {
  const value = data.get(name);
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= maxLength ? clean : null;
}

export function optionalField(data: FormData, name: string, maxLength: number): string | null | undefined {
  const value = data.get(name);
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (clean.length > maxLength) return undefined;
  return clean || null;
}

export function dateField(data: FormData, name: string): string | null {
  const value = data.get(name);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value.startsWith("0000")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function uuidField(data: FormData, name: string): string | null {
  const value = data.get(name);
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}
