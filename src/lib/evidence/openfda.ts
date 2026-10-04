import type {
  DrugEventData,
  DrugLabelData,
  DrugLabelRecord,
  DrugSafetySource,
  EvidenceBase,
  EvidenceFailureReason,
  EvidenceKind,
  EvidenceLookup,
  ReportedSexCount,
} from "./types";

const API_ROOT = "https://api.fda.gov";
const LABEL_LIMIT = 3;
const LABEL_LIMITATIONS = [
  "Only up to three matching US drug-label records are returned; products and formulations may differ.",
  "A missing label or section does not show that a medication or effect is safe or absent.",
  "openFDA label records are source text, not a diagnosis or treatment recommendation.",
];
const EVENT_LIMITATIONS = [
  "These are spontaneous adverse-event report counts, not incidence rates or individual risk estimates.",
  "A report mentioning a drug does not establish that the drug caused the reported event.",
  "Drug names in reports are not systematically normalized; matching may miss reports or include related product descriptions.",
  "Reported sex may be missing or unknown. Counts must not be treated as comparable exposure-adjusted rates.",
];

type JsonObject = Record<string, unknown>;
type RawResult =
  | { kind: "ok"; body: unknown }
  | { kind: "not_found" }
  | { kind: "unavailable"; reason: EvidenceFailureReason };

export interface OpenFdaOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
  now?: () => number;
  successTtlMs?: number;
  notFoundTtlMs?: number;
  maxCacheEntries?: number;
}

export function parseMedicationName(input: string | null): string | null {
  if (input === null) return null;
  const name = input.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) return null;
  // Keep openFDA's query language out of the user-provided term.
  return /^[\p{L}\p{N}][\p{L}\p{N} .+/'()-]*$/u.test(name) ? name : null;
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function lastUpdated(body: JsonObject): string | null {
  return text(object(body.meta)?.last_updated);
}

function resultTotal(body: JsonObject): number | null {
  return nonnegativeInteger(object(object(body.meta)?.results)?.total);
}

function labelRecord(value: unknown): DrugLabelRecord | null {
  const record = object(value);
  if (!record || !text(record.id)) return null;
  const openfda = object(record.openfda);
  return {
    id: record.id as string,
    setId: text(record.set_id),
    effectiveTime: text(record.effective_time),
    brandNames: textArray(openfda?.brand_name),
    genericNames: textArray(openfda?.generic_name),
    productTypes: textArray(openfda?.product_type),
    boxedWarnings: textArray(record.boxed_warning),
    warnings: textArray(record.warnings),
    warningsAndCautions: textArray(record.warnings_and_cautions),
    adverseReactions: textArray(record.adverse_reactions),
  };
}

function sexCounts(value: unknown): ReportedSexCount[] | null {
  if (!Array.isArray(value)) return null;
  const counts: ReportedSexCount[] = [];
  for (const item of value) {
    const row = object(item);
    const count = nonnegativeInteger(row?.count);
    const code = row?.term;
    if (count === null || (typeof code !== "string" && typeof code !== "number")) return null;
    counts.push({ code: String(code), reportCount: count });
  }
  return counts;
}

function reactionCounts(value: unknown): DrugEventData["femaleReactions"]["counts"] {
  if (!Array.isArray(value)) return null;
  const counts: NonNullable<DrugEventData["femaleReactions"]["counts"]> = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = object(item), term = text(row?.term), count = nonnegativeInteger(row?.count);
    if (!term || count === null || seen.has(term)) return null;
    seen.add(term);
    counts.push({term, reportCount: count});
  }
  return counts.sort((a,b) => b.reportCount-a.reportCount).slice(0,4);
}

export function createOpenFdaAdapter(options: OpenFdaOptions = {}): DrugSafetySource {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const successTtlMs = options.successTtlMs ?? 6 * 60 * 60 * 1000;
  const notFoundTtlMs = options.notFoundTtlMs ?? 10 * 60 * 1000;
  const maxCacheEntries = Math.max(1, options.maxCacheEntries ?? 100);
  const cache = new Map<string, { expiresAt: number; value: EvidenceLookup<unknown> }>();
  const inflight = new Map<string, Promise<EvidenceLookup<unknown>>>();

  function url(path: string, params: Record<string, string>, includeKey: boolean): string {
    const result = new URL(path, API_ROOT);
    if (includeKey && options.apiKey) result.searchParams.set("api_key", options.apiKey);
    for (const [key, value] of Object.entries(params)) result.searchParams.set(key, value);
    return result.toString();
  }

  function base(kind: EvidenceKind, medicationName: string, sourceUrls: string[], limitations: string[]): EvidenceBase {
    return {
      source: "openFDA",
      kind,
      medicationName,
      fetchedAt: new Date(now()).toISOString(),
      cached: false,
      sourceUrls,
      limitations,
    };
  }

  function unavailable<T>(
    kind: EvidenceKind,
    medicationName: string,
    sourceUrls: string[],
    limitations: string[],
    reason: EvidenceFailureReason,
  ): EvidenceLookup<T> {
    const message = reason === "rate_limited" ? "openFDA rate limit reached. Try again later."
      : reason === "timeout" ? "openFDA did not respond in time. Try again later."
      : reason === "invalid_response" ? "openFDA returned data in an unexpected format."
      : "openFDA is currently unavailable. Try again later.";
    return { ...base(kind, medicationName, sourceUrls, limitations), status: "unavailable", data: null, reason, message };
  }

  async function request(path: string, params: Record<string, string>): Promise<RawResult> {
    try {
      const response = await fetcher(url(path, params, true), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (response.status === 404) return { kind: "not_found" };
      if (response.status === 429) return { kind: "unavailable", reason: "rate_limited" };
      if (!response.ok) return { kind: "unavailable", reason: "upstream_error" };
      try {
        return { kind: "ok", body: await response.json() };
      } catch {
        return { kind: "unavailable", reason: "invalid_response" };
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      return { kind: "unavailable", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "upstream_error" };
    }
  }

  async function cached<T>(key: string, load: () => Promise<EvidenceLookup<T>>): Promise<EvidenceLookup<T>> {
    const stored = cache.get(key);
    if (stored && stored.expiresAt > now()) {
      cache.delete(key);
      cache.set(key, stored);
      return { ...stored.value, cached: true } as EvidenceLookup<T>;
    }
    if (stored) cache.delete(key);
    const pending = inflight.get(key);
    if (pending) return { ...(await pending), cached: true } as EvidenceLookup<T>;

    const work = load().then((value) => {
      if (value.status === "ok" || value.status === "not_found") {
        const ttl = value.status === "not_found" ? notFoundTtlMs
          : value.kind === "drug_event" && typeof value.data === "object" && value.data !== null
            && (("sexCountStatus" in value.data && value.data.sexCountStatus === "unavailable")
              || ("femaleReactions" in value.data && object(value.data.femaleReactions)?.status === "unavailable"))
            ? notFoundTtlMs : successTtlMs;
        cache.set(key, { value, expiresAt: now() + ttl });
        if (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value!);
      }
      return value;
    }).finally(() => inflight.delete(key));
    inflight.set(key, work);
    return work;
  }

  async function lookupLabels(medicationName: string): Promise<EvidenceLookup<DrugLabelData>> {
    const validName = parseMedicationName(medicationName);
    if (!validName) {
      return { ...base("drug_label", medicationName, [], LABEL_LIMITATIONS), status: "invalid_request", data: null, message: "Medication name cannot be queried safely." };
    }
    medicationName = validName;
    return cached(`label:${medicationName}`, async () => {
      const variants = [...new Set([
        medicationName,
        medicationName.toUpperCase(),
        medicationName.split(" ").map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase()).join(" "),
      ])];
      const sourceUrls: string[] = [];
      for (const variant of variants) {
        const search = `(openfda.brand_name.exact:"${variant}" OR openfda.generic_name.exact:"${variant}")`;
        const params = { search, limit: String(LABEL_LIMIT) };
        sourceUrls.push(url("/drug/label.json", params, false));
        const response = await request("/drug/label.json", params);
        if (response.kind === "not_found") continue;
        if (response.kind === "unavailable") {
          return unavailable("drug_label", medicationName, sourceUrls, LABEL_LIMITATIONS, response.reason);
        }
        const body = object(response.body);
        if (!body || !Array.isArray(body.results)) {
          return unavailable("drug_label", medicationName, sourceUrls, LABEL_LIMITATIONS, "invalid_response");
        }
        if (body.results.length === 0) continue;
        const labels = body.results.map(labelRecord).filter((item): item is DrugLabelRecord => item !== null);
        if (!labels.length) {
          return unavailable("drug_label", medicationName, sourceUrls, LABEL_LIMITATIONS, "invalid_response");
        }
        return {
          ...base("drug_label", medicationName, sourceUrls, LABEL_LIMITATIONS),
          status: "ok" as const,
          data: {
            matchedNameVariant: variant,
            totalMatchingLabels: resultTotal(body),
            datasetLastUpdated: lastUpdated(body),
            labels,
          },
        };
      }
      return {
        ...base("drug_label", medicationName, sourceUrls, LABEL_LIMITATIONS),
        status: "not_found" as const,
        data: null,
        message: "No matching openFDA drug label was found for this name.",
      };
    });
  }

  async function lookupEvents(medicationName: string): Promise<EvidenceLookup<DrugEventData>> {
    const validName = parseMedicationName(medicationName);
    if (!validName) {
      return { ...base("drug_event", medicationName, [], EVENT_LIMITATIONS), status: "invalid_request", data: null, message: "Medication name cannot be queried safely." };
    }
    medicationName = validName;
    return cached(`event:${medicationName}`, async () => {
      const search = `patient.drug.medicinalproduct:"${medicationName}"`;
      const reportParams = { search, limit: "1" };
      const countParams = { search, count: "patient.patientsex" };
      const reactionParams = { search: `(${search}) AND patient.patientsex:2`, count: "patient.reaction.reactionmeddrapt.exact", limit: "4" };
      const reportUrl = url("/drug/event.json", reportParams, false);
      const countUrl = url("/drug/event.json", countParams, false);
      const reactionUrl = url("/drug/event.json", reactionParams, false);
      const reportResponse = await request("/drug/event.json", reportParams);
      if (reportResponse.kind === "not_found") {
        return {
          ...base("drug_event", medicationName, [reportUrl], EVENT_LIMITATIONS),
          status: "not_found" as const,
          data: null,
          message: "No matching openFDA adverse-event reports were found for this name.",
        };
      }
      if (reportResponse.kind === "unavailable") {
        return unavailable("drug_event", medicationName, [reportUrl], EVENT_LIMITATIONS, reportResponse.reason);
      }
      const reportBody = object(reportResponse.body);
      const total = reportBody ? resultTotal(reportBody) : null;
      if (total === null) {
        return unavailable("drug_event", medicationName, [reportUrl], EVENT_LIMITATIONS, "invalid_response");
      }
      if (total === 0) {
        return {
          ...base("drug_event", medicationName, [reportUrl], EVENT_LIMITATIONS),
          status: "not_found" as const,
          data: null,
          message: "No matching openFDA adverse-event reports were found for this name.",
        };
      }

      const [countResponse, reactionResponse] = await Promise.all([
        request("/drug/event.json", countParams), request("/drug/event.json", reactionParams),
      ]);
      let reportedSexCounts: ReportedSexCount[] | null = null;
      let sexCountStatus: DrugEventData["sexCountStatus"] = "missing";
      if (countResponse.kind === "ok") {
        const countBody = object(countResponse.body);
        reportedSexCounts = countBody ? sexCounts(countBody.results) : null;
        sexCountStatus = reportedSexCounts === null ? "unavailable" : reportedSexCounts.length === 0 ? "missing" : "available";
      } else if (countResponse.kind === "unavailable") {
        sexCountStatus = "unavailable";
      }
      const femaleReactions: DrugEventData["femaleReactions"] = {status:"missing", counts:null, sourceUrl:reactionUrl, datasetLastUpdated:null};
      if (reactionResponse.kind === "ok") {
        const body = object(reactionResponse.body);
        femaleReactions.counts = body ? reactionCounts(body.results) : null;
        femaleReactions.status = femaleReactions.counts === null ? "unavailable" : femaleReactions.counts.length ? "available" : "missing";
        femaleReactions.datasetLastUpdated = body ? lastUpdated(body) : null;
      } else if (reactionResponse.kind === "unavailable") femaleReactions.status = "unavailable";
      const limitations = sexCountStatus === "available" ? EVENT_LIMITATIONS
        : [...EVENT_LIMITATIONS, "Sex-stratified counts were not available for this lookup."];
      return {
        ...base("drug_event", medicationName, [reportUrl, countUrl, reactionUrl], limitations),
        status: "ok" as const,
        data: {
          matchedReportCount: total,
          datasetLastUpdated: lastUpdated(reportBody!),
          reportedSexCounts,
          sexCountStatus,
          femaleReactions,
        },
      };
    });
  }

  return { lookupLabels, lookupEvents };
}
