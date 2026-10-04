"use client";

import { useRef, useState } from "react";
import { parsePrescription, type PrescriptionCandidate } from "@/lib/prescription";
import { savePrescription } from "@/app/prescription-actions";
import { SaveButton } from "./save-button";
import { useLocale, useT } from "./preferences-provider";

const emptyCandidate = (): PrescriptionCandidate => ({ name: "", dose: "", startedOn: "", takeTime: "", remindTime: "", sourceLine: "" });

export function PrescriptionScanner() {
  const en = useLocale() === "en", t = useT(), file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<PrescriptionCandidate[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const scanning = useRef(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(false);
  const extractedCount = draft.filter(item => item.name && item.sourceLine).length;

  function fillFromText(value: string) {
    setText(value);
    setDraft(parsePrescription(value));
    setConfirmed(false);
    setParsed(true);
    setError("");
  }

  async function scan(image = file.current?.files?.[0]) {
    if (!image || scanning.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type) || image.size > 10_000_000) {
      setError(en ? "Choose a PNG, JPEG or WebP up to 10 MB." : "Wybierz PNG, JPEG lub WebP do 10 MB.");
      return;
    }
    scanning.current = true;
    setBusy(true); setProgress(0); setError(""); setConfirmed(false);
    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["pol", "eng"], 1, {
        workerPath: "/ocr/worker.min.js", corePath: "/ocr/core", langPath: "/ocr/lang",
        logger: message => { if (message.status === "recognizing text") setProgress(Math.round(message.progress * 100)); },
      });
      const result = await worker.recognize(image);
      fillFromText(result.data.text.slice(0, 12000));
      if (!result.data.text.trim()) setError(en ? "No readable text. Try a clearer image or enter the text below." : "Brak czytelnego tekstu. Spróbuj wyraźniejszego zdjęcia albo wpisz tekst poniżej.");
    } catch {
      setError(en ? "OCR failed. Paste the prescription text below or add the medication manually." : "Odczyt nie powiódł się. Wklej tekst recepty poniżej lub dodaj lek ręcznie.");
    } finally {
      try { await worker?.terminate(); } finally { scanning.current = false; setBusy(false); }
    }
  }

  function change(index: number, key: keyof PrescriptionCandidate, value: string) {
    setConfirmed(false);
    setDraft(current => current.map((item, i) => i === index ? { ...item, [key]: value, ...(key === "dose" ? { doseSource: undefined } : {}) } : item));
  }

  return <div className="space-y-6">
    <section className="card">
      <p className="eyebrow">{en ? "01 · Read locally" : "01 · Odczytaj lokalnie"}</p>
      <h2 className="section-title mt-3">{t("Wybierz zdjęcie")}</h2>
      <p className="section-copy">{en ? "Use a clear crop containing medication names and dosing instructions. OCR runs on this device. The image and full text are not uploaded or stored." : "Wybierz wyraźny fragment z nazwami leków i instrukcją dawkowania. Odczyt działa na tym urządzeniu. Zdjęcie i pełny tekst nie są wysyłane ani zapisywane."}</p>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("Wybierz zdjęcie")} className="input" disabled={busy} onChange={event => { void scan(event.target.files?.[0]); }} />
      <p className="section-copy">{en ? "Choosing an image starts reading and fills the review fields automatically." : "Po wybraniu zdjęcia odczyt rozpocznie się automatycznie i uzupełni pola do sprawdzenia."}</p>
      <button type="button" className="button-secondary mt-4" onClick={() => { void scan(); }} disabled={busy}>{busy ? `${en ? "Reading" : "Odczyt"} ${progress}%` : t("Odczytaj zdjęcie")}</button>
      {busy && <div className="scan-progress" role="progressbar" aria-label={t("Odczytaj zdjęcie")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
      {error && <p role="alert" className="notice-error mt-4">{error}</p>}
      <details className="mt-5">
        <summary className="text-button">{t("Tekst odczytany ze zdjęcia")} / {en ? "paste text" : "wklej tekst"}</summary>
        <label htmlFor="prescription-text" className="label mt-4">{t("Tekst odczytany ze zdjęcia")}</label>
        <textarea id="prescription-text" value={text} onChange={event => fillFromText(event.target.value)} maxLength={12000} rows={7} className="input" disabled={busy} />
        <p className="section-copy">{en ? "Pasting or editing this text automatically rebuilds the draft below. Then correct any fields that need review." : "Wklejenie lub zmiana tego tekstu automatycznie tworzy szkic poniżej. Następnie popraw pola wymagające sprawdzenia."}</p>
        <button type="button" onClick={() => fillFromText(text)} disabled={busy} className="button-quiet mt-3">{en ? "Fill fields again from text" : "Uzupełnij pola ponownie z tekstu"}</button>
      </details>
    </section>
    <section className="card">
      <p className="eyebrow">{en ? "02 · Review before saving" : "02 · Sprawdź przed zapisem"}</p>
      <h2 className="section-title mt-3">{t("Sprawdź każdy lek i potwierdź")}</h2>
      <p className="notice-attention mt-4 mb-5">{en ? "OCR can misread names, units and instructions. We copy readable medication names, strengths, written dosing instructions and explicit times. Strength is not necessarily the prescribed dose. A prescription's issue date is not a treatment start date; ‘1x1’ or ‘twice daily’ does not specify a clock time." : "Odczyt może pomylić nazwy, jednostki i instrukcje. Przepisujemy czytelne nazwy leków, moce, zapis dawkowania i jawne godziny. Moc leku nie musi oznaczać zaleconej dawki. Data wystawienia recepty nie jest datą rozpoczęcia leczenia; zapis „1x1” lub „2 razy dziennie” nie określa godziny."}</p>
      {parsed && !busy && <p role="status" className="section-copy mb-4">{extractedCount
        ? (en ? "Readable prescription details have been copied into the fields below. Review them and complete any missing information before confirming." : "Czytelne dane z recepty zostały wpisane w pola poniżej. Sprawdź je i uzupełnij brakujące informacje przed potwierdzeniem.")
        : (en ? "No medication was recognised. Correct the text or add a draft manually." : "Nie rozpoznano leku. Popraw odczytany tekst albo dodaj pozycję ręcznie.")}</p>}
      <form action={savePrescription}>
        <input type="hidden" name="candidates" value={JSON.stringify(draft)} />
        <fieldset disabled={busy} className="space-y-5 border-0 p-0 m-0 min-w-0">
          {draft.map((item, index) => <article key={index} className="prescription-candidate">
            <div className="section-heading"><h3>{en ? "Medication" : "Lek"} {index + 1}</h3><button type="button" className="text-button" onClick={() => { setConfirmed(false); setDraft(current => current.filter((_, i) => i !== index)); }}>{t("Usuń pozycję")}</button></div>
            {item.sourceLine && <blockquote className="whitespace-pre-line">{item.sourceLine}</blockquote>}
            {item.doseSource === "instructions" && <p className="section-copy mb-4">{en ? "The dose field contains the literal dosing instruction from the prescription. Medication strength was not read. Check the instruction against the original before confirming." : "W polu dawki wpisano dosłowną instrukcję dawkowania z recepty. Moc leku nie została odczytana. Sprawdź zapis z oryginałem przed potwierdzeniem."}</p>}
            {item.doseSource === "missing" && <p className="section-copy mb-4">{en ? "Medication name was read, but no strength or dosing instruction was readable. Complete the dose from the original prescription." : "Odczytano nazwę leku, ale nie znaleziono czytelnej mocy ani instrukcji dawkowania. Uzupełnij dawkę z oryginalnej recepty."}</p>}
            <div className="form-pair">{([
              { key: "name", label: "Nazwa leku", type: "text" },
              { key: "dose", label: "Dawka", type: "text" },
              { key: "startedOn", label: "Data rozpoczęcia", type: "date" },
              { key: "takeTime", label: "Godzina dawki", type: "time" },
              { key: "remindTime", label: "Godzina przypomnienia", type: "time" },
            ] as const).map(field => <div key={field.key}>
              <label htmlFor={`rx-${index}-${field.key}`} className="label">{t(field.label)}{field.type === "time" ? ` ${t("(opcjonalnie)")}` : ""}</label>
              <input id={`rx-${index}-${field.key}`} value={item[field.key]} onChange={event => change(index, field.key, event.target.value)} required={field.type !== "time"} type={field.type} maxLength={120} className="input" />
            </div>)}</div>
          </article>)}
          {!draft.length && <p className="section-copy">{en ? "No candidates yet. Read or paste the text, or add an empty draft." : "Jeszcze bez pozycji. Odczytaj lub wklej tekst albo dodaj pusty szkic."}</p>}
          {draft.length < 5 && <button type="button" className="button-quiet" onClick={() => { setConfirmed(false); setDraft(current => [...current, emptyCandidate()]); }}>{t("Dodaj pozycję")}</button>}
          {draft.length > 0 && <>
            <label className="profile-confirmation"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{t("Potwierdzam zgodność z receptą")}. {en ? "I checked every name, dose, start date and optional time. These details will be saved to my account." : "Sprawdziłam każdą nazwę, dawkę, datę rozpoczęcia i opcjonalną godzinę. Te dane zostaną zapisane na moim koncie."}</span></label>
            <SaveButton>{t("Zapisz szkic recepty")}</SaveButton>
          </>}
        </fieldset>
      </form>
    </section>
  </div>;
}
