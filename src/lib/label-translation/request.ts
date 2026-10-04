import { UUID_PATTERN } from "../validation.ts";
import { isLabelSection, labelSectionParagraphs, presentLabelTopics, type LabelSection } from "../label-presentation.ts";
import type { DrugLabelRecord } from "../evidence/types.ts";

export type LabelTranslationRequest = { medicationId: string; labelId: string; section: LabelSection; paragraphIndex?: number };

/** Only identifiers are accepted. Source wording is retrieved on the server. */
export function parseLabelTranslationRequest(value: unknown): LabelTranslationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort().join();
  if (keys !== "labelId,medicationId,section" && keys !== "labelId,medicationId,paragraphIndex,section") return null;
  if (typeof body.medicationId !== "string" || !UUID_PATTERN.test(body.medicationId) || typeof body.labelId !== "string" || !UUID_PATTERN.test(body.labelId) || !isLabelSection(body.section)) return null;
  if (Object.hasOwn(body, "paragraphIndex") && (typeof body.paragraphIndex !== "number" || !Number.isSafeInteger(body.paragraphIndex) || body.paragraphIndex < 0 || body.paragraphIndex > 1000)) return null;
  return body as LabelTranslationRequest;
}

export function sourceTranslationTopics(label: DrugLabelRecord, request: Pick<LabelTranslationRequest, "section" | "paragraphIndex">) {
  const paragraphs = labelSectionParagraphs(label, request.section);
  if (request.paragraphIndex === undefined) return presentLabelTopics(paragraphs);
  const paragraph = paragraphs[request.paragraphIndex];
  // Full literal paragraph: do not strip headings or select only the matched symptom.
  return paragraph?.trim() ? [{ heading: null, text: paragraph }] : [];
}
