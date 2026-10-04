"use client";

import { useEffect, useState } from "react";
import type { DrugLabelRecord } from "@/lib/evidence/types";
import { useLocale } from "./preferences-provider";

const translations = new Map<string, Promise<string>>();

function translateParagraph(medicationId: string, labelId: string, paragraphIndex: number, original: string): Promise<string> {
  const key = JSON.stringify([medicationId, labelId, paragraphIndex, original]);
  const saved = translations.get(key);
  if (saved) return saved;
  const work = (async () => {
    const response = await fetch("/api/evidence/label/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicationId, labelId, section: "adverseReactions", paragraphIndex }),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json();
    if (!response.ok || data.status !== "ok" || data.language !== "pl" || data.labelId !== labelId || data.section !== "adverseReactions" || data.paragraphIndex !== paragraphIndex || !Array.isArray(data.topics) || data.topics.length !== 1 || data.topics[0]?.heading !== null || typeof data.topics[0]?.text !== "string" || !data.topics[0].text.trim()) throw Error("translation_unavailable");
    return data.topics[0].text as string;
  })();
  translations.set(key, work);
  if (translations.size > 128) translations.delete(translations.keys().next().value!);
  work.catch(() => { if (translations.get(key) === work) translations.delete(key); });
  return work;
}

function PolishParagraph({ medicationId, labelId, paragraphIndex, original }: { medicationId: string; labelId: string; paragraphIndex: number; original: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setText(null); setFailed(false);
    translateParagraph(medicationId, labelId, paragraphIndex, original).then(result => { if (alive) setText(result); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [medicationId, labelId, paragraphIndex, original, attempt]);
  return <div className="quote-paragraph-translation" data-translation-status={text ? "ready" : failed ? "unavailable" : "loading"}>
    {text ? <p lang="pl">{text}</p> : <p role="status">{failed ? "Polskie tłumaczenie jest chwilowo niedostępne. Oryginał FDA znajdziesz poniżej." : "Przygotowuję polskie tłumaczenie kontekstu…"}</p>}
    {failed && <button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Spróbuj ponownie</button>}
    <details className="quote-original-text"><summary>Oryginalny tekst FDA (EN)</summary><p lang="en">{original}</p></details>
  </div>;
}

export function LabelQuoteContext({ medicationId, label, phrase }: { medicationId: string; label?: DrugLabelRecord; phrase: string }) {
  const en = useLocale() === "en";
  const paragraphs = (label?.adverseReactions ?? []).map((text, index) => ({ text, index })).filter(paragraph => paragraph.text.includes(phrase));
  if (!label || !paragraphs.length) return <p>{en ? "The full excerpt is unavailable here. Check the FDA source linked below." : "Pełny fragment jest tutaj niedostępny. Sprawdź źródło FDA pod listą objawów."}</p>;
  if (en) return <>{paragraphs.map(paragraph => <p key={paragraph.index} lang="en">{paragraph.text}</p>)}</>;
  return <>
    <div className="quote-translation-notice"><span className="translation-badge">PL · tłumaczenie pomocnicze AI</span><p>Automatyczne tłumaczenie może zawierać błędy. Źródłem informacji pozostaje oryginalny tekst FDA.</p></div>
    {paragraphs.map(paragraph => <PolishParagraph key={paragraph.index} medicationId={medicationId} labelId={label.id} paragraphIndex={paragraph.index} original={paragraph.text} />)}
  </>;
}
