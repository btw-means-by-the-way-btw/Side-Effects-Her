export type EvidenceKind = "drug_label" | "drug_event";
export type EvidenceFailureReason = "rate_limited" | "timeout" | "upstream_error" | "invalid_response";

export interface EvidenceBase {
  source: "openFDA";
  kind: EvidenceKind;
  medicationName: string;
  fetchedAt: string;
  cached: boolean;
  sourceUrls: string[];
  limitations: string[];
}

export type EvidenceLookup<T> =
  | (EvidenceBase & { status: "ok"; data: T })
  | (EvidenceBase & { status: "not_found"; data: null; message: string })
  | (EvidenceBase & { status: "invalid_request"; data: null; message: string })
  | (EvidenceBase & { status: "unavailable"; data: null; reason: EvidenceFailureReason; message: string });

export interface DrugLabelRecord {
  id: string;
  setId: string | null;
  effectiveTime: string | null;
  brandNames: string[];
  genericNames: string[];
  productTypes: string[];
  boxedWarnings: string[];
  warnings: string[];
  warningsAndCautions: string[];
  adverseReactions: string[];
}

export interface DrugLabelData {
  matchedNameVariant: string;
  totalMatchingLabels: number | null;
  datasetLastUpdated: string | null;
  labels: DrugLabelRecord[];
}

export interface ReportedSexCount {
  /** Raw code returned by openFDA. No patient identity is inferred. */
  code: string;
  reportCount: number;
}

export interface DrugEventData {
  matchedReportCount: number;
  datasetLastUpdated: string | null;
  reportedSexCounts: ReportedSexCount[] | null;
  sexCountStatus: "available" | "missing" | "unavailable";
  femaleReactions: {
    status: "available" | "missing" | "unavailable";
    /** Exact MedDRA terms counted in reports with patient.patientsex=2. No clinical ranking. */
    counts: Array<{ term: string; reportCount: number }> | null;
    sourceUrl: string;
    datasetLastUpdated: string | null;
  };
}

/** Future sources (for example EMA) can implement the same contract. */
export interface DrugSafetySource {
  lookupLabels(medicationName: string): Promise<EvidenceLookup<DrugLabelData>>;
  lookupEvents(medicationName: string): Promise<EvidenceLookup<DrugEventData>>;
}
