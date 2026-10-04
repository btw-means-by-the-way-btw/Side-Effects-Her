"use client";
import { T } from "@/components/preferences-provider";
import { LocalizedTextarea, LocalizedInput, LocalizedOption } from "@/components/localized-fields";


import { useState } from "react";
import { confirmParsedSymptoms } from "@/app/actions";
import { SaveButton } from "@/components/save-button";
import type { SymptomCandidate } from "@/lib/symptom-draft/openai";
import { LifeImpactFields } from "@/components/life-impact-fields";

export function NaturalLanguageSymptomEntry({ medicationId, enabled }: { medicationId: string; enabled: boolean }) {
  const [statement, setStatement] = useState("");
  const [candidates, setCandidates] = useState<SymptomCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidateKeys, setCandidateKeys] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCandidates(null);
    setConfirmed(false);
    try {
      const response = await fetch("/api/symptoms/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, statement }),
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("candidates" in result) || !Array.isArray(result.candidates)) {
        const message = result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : "Nie udało się przygotować szkicu. Użyj formularza ręcznego lub spróbuj ponownie.";
        setError(message);
        return;
      }
      setCandidates(result.candidates as SymptomCandidate[]);
      setCandidateKeys(result.candidates.map(() => crypto.randomUUID()));
    } catch {
      setError("Nie udało się przygotować szkicu. Użyj formularza ręcznego lub spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  function change(index: number, patch: Partial<SymptomCandidate>) {
    setCandidates((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) ?? null);
  }

  return <section className="card">
    <p className="step"><T text={"Opcjonalny szkic AI"}/></p>
    <h2 className="text-lg font-semibold text-foreground"><T text={"Opisz zmianę własnymi słowami"}/></h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground"><T text={"AI zamienia wyłącznie Twój opis w pola do sprawdzenia. Nie ocenia przyczyn ani nie udziela porad medycznych."}/></p>
    {!enabled && <p className="notice mt-4"><T text={"Szkic AI nie jest skonfigurowany. Możesz użyć formularza ręcznego powyżej."}/></p>}

    {candidates === null ? <form onSubmit={createDraft} className="mt-5 space-y-3">
      <label htmlFor="symptom-statement" className="label"><T text={"Co zauważyłaś?"}/></label>
      <LocalizedTextarea id="symptom-statement" value={statement} onChange={(event) => setStatement(event.target.value)} required maxLength={2000} rows={4} disabled={!enabled || busy} placeholder="Opisz, co się zmieniło, kiedy to zauważyłaś i co chcesz zapamiętać." className="input resize-y" />
      <p className="text-xs leading-5 text-muted-foreground"><T text={"Po wybraniu „Przygotuj szkic” Twój opis jest wysyłany do OpenAI w celu wyodrębnienia pól. Zapis w bazie nastąpi dopiero po Twoim potwierdzeniu."}/></p>
      {error && <p role="alert" className="notice-error"><T text={error}/></p>}
      <button type="submit" disabled={!enabled || busy || !statement.trim()} className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"><T text={busy ? "Przygotowuję szkic…" : "Przygotuj szkic AI"}/></button>
    </form> : <div className="mt-5">
      <div className="rounded-xl border border-border bg-background px-4 py-3">
        <p className="eyebrow text-primary"><T text={"Twój oryginalny opis"}/></p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{statement}</p>
      </div>
      {candidates.length === 0 ? <p className="notice mt-4"><T text={"Nie znaleziono jednoznacznego objawu. Spróbuj ponownie lub użyj formularza ręcznego."}/></p> : <form action={confirmParsedSymptoms} onChange={event => { if ((event.target as unknown as HTMLInputElement).name !== "confirmed") setConfirmed(false); }} className="mt-4 space-y-4">
        <input type="hidden" name="medication_id" value={medicationId} />
        <input type="hidden" name="candidates" value={JSON.stringify(candidates)} />
        <p className="text-sm font-medium text-foreground"><T text={"Sprawdź i popraw każde pole przed zapisem"}/></p>
        {candidates.map((candidate, index) => <div key={candidateKeys[index]} className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-medium text-foreground"><T text={"Obserwacja"}/>{index + 1}</h3><button type="button" onClick={() => { setConfirmed(false); setCandidateKeys(current => current.filter((_, i) => i !== index)); setCandidates((current) => current?.filter((_, itemIndex) => itemIndex !== index) ?? null); }} className="inline-flex min-h-11 items-center text-xs font-medium text-destructive underline underline-offset-4"><T text={"Usuń"}/></button></div>
          <div className="space-y-3">
            <div><label htmlFor={`draft-symptom-${index}`} className="label"><T text={"Objaw"}/></label><LocalizedInput id={`draft-symptom-${index}`} value={candidate.symptom} onChange={(event) => change(index, { symptom: event.target.value })} required maxLength={120} className="input" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor={`draft-severity-${index}`} className="label"><T text={"Nasilenie — Twoja ocena"}/></label><select id={`draft-severity-${index}`} value={candidate.severity ?? ""} onChange={(event) => change(index, { severity: event.target.value ? Number(event.target.value) : null })} required className="input"><LocalizedOption value="" disabled>Wybierz 1–5</LocalizedOption>{[1, 2, 3, 4, 5].map((severity) => <LocalizedOption key={severity} value={severity}>{severity}/5</LocalizedOption>)}</select></div>
              <div><label htmlFor={`draft-date-${index}`} className="label"><T text={"Potwierdzona data pojawienia się"}/></label><LocalizedInput id={`draft-date-${index}`} type="date" value={candidate.onsetOn ?? ""} onChange={(event) => change(index, { onsetOn: event.target.value || null })} required className="input" /></div>
            </div>
            <div><label htmlFor={`draft-note-${index}`} className="label"><T text={"Notatka"}/><span className="font-normal text-muted-foreground"><T text={"(opcjonalnie)"}/></span></label><LocalizedTextarea id={`draft-note-${index}`} value={candidate.note ?? ""} onChange={(event) => change(index, { note: event.target.value || null })} maxLength={1000} rows={2} className="input resize-y" /></div>
            <LifeImpactFields suffix={`_${index}`} />
          </div>
        </div>)}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-secondary px-4 py-3 text-sm text-secondary-foreground"><LocalizedInput type="checkbox" name="confirmed" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-primary" /><span><T text={"Sprawdziłam te wpisy i potwierdzam, że odpowiadają moim obserwacjom."}/></span></label>
        <SaveButton><T text={"Potwierdzam i zapisuję"}/>{candidates.length} <T text={candidates.length === 1 ? "obserwację" : candidates.length % 10 >= 2 && candidates.length % 10 <= 4 && !(candidates.length % 100 >= 12 && candidates.length % 100 <= 14) ? "obserwacje" : "obserwacji"}/></SaveButton>
      </form>}
      <button type="button" onClick={() => { setCandidates(null); setError(null); }} className="mt-4 inline-flex min-h-11 items-center text-sm text-link"><T text={"Wróć do opisu lub zacznij od nowa"}/></button>
    </div>}
  </section>;
}
