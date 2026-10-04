import { polishLabelHeading, topicBody, type LabelTopic } from "../label-presentation.ts";
import { splitTranslationText, type SourceSegment, type TranslatedSegment } from "./adapter.ts";

export function planLabelTranslation(topics: LabelTopic[]): SourceSegment[] {
  return topics.flatMap((topic, index) => {
    const body = topicBody(topic) || topic.text;
    const segments = splitTranslationText(body).map((text, part) => ({ id: `${index}:body:${part}`, text }));
    if (topic.heading && !polishLabelHeading(topic.heading)) segments.push({ id: `${index}:heading`, text: topic.heading.replace(/^\d+\.?\s*/, "").trim() });
    return segments;
  });
}

export function translatedLabelTopics(topics: LabelTopic[], segments: TranslatedSegment[]): Array<{ heading: string | null; text: string }> {
  const translated = new Map(segments.map(segment => [segment.id, segment.text]));
  return topics.map((topic, index) => ({
    heading: polishLabelHeading(topic.heading) ?? translated.get(`${index}:heading`) ?? null,
    text: splitTranslationText(topicBody(topic) || topic.text).map((_, part) => translated.get(`${index}:body:${part}`)!).join("\n\n"),
  }));
}
