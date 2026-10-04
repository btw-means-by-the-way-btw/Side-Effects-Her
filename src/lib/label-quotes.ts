import type { MedicationSymptomSource } from "./models.ts";

export interface LabelQuote {
  groupId: string;
  phrase: string;
  sources: MedicationSymptomSource[];
}

/** Collapse identical display quotes only; retain distinct labels and source queries. */
export function groupLabelQuotes(sources: MedicationSymptomSource[]): LabelQuote[] {
  const quotes = new Map<string, LabelQuote>();
  for (const source of sources) {
    const key = JSON.stringify([source.symptom_group_id, source.exact_phrase]);
    let quote = quotes.get(key);
    if (!quote) {
      quote = { groupId: source.symptom_group_id, phrase: source.exact_phrase, sources: [] };
      quotes.set(key, quote);
    }
    if (!quote.sources.some(existing => existing.label_id === source.label_id && existing.source_url === source.source_url && existing.label_effective_time === source.label_effective_time)) {
      quote.sources.push(source);
    }
  }
  return [...quotes.values()];
}
