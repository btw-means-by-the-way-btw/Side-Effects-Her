import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseMedicationName } from "@/lib/evidence/openfda";
import { openFdaSource } from "@/lib/evidence/server";
import { T } from "@/components/preferences-provider";
import { LocalizedInput } from "@/components/localized-fields";

export const metadata: Metadata = { title: "Test openFDA · Side Effects Her", robots: { index: false, follow: false } };

export default async function OpenFdaTestPage({ searchParams }: { searchParams: Promise<{ medication?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const requested = (await searchParams).medication ?? "";
  const medicationName = parseMedicationName(requested);
  const invalid = requested.trim() && !medicationName;
  const results = medicationName
    ? await Promise.all([openFdaSource().lookupLabels(medicationName), openFdaSource().lookupEvents(medicationName)])
    : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <p className="eyebrow text-evidence"><T text="Test techniczny · etap 2"/></p>
      <h1 className="mt-2 text-3xl font-bold"><T text="Połączenie z openFDA"/></h1>
      <p className="mt-3 max-w-3xl text-sm text-stone-600"><T text="Ta strona pokazuje dane źródłowe i liczby zgłoszeń do testowania połączenia. Nie porównuje ich z osobistą historią i nie wyciąga wniosków medycznych."/></p>
      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <label htmlFor="medication" className="sr-only"><T text="Nazwa leku"/></label>
        <LocalizedInput id="medication" name="medication" defaultValue={requested} maxLength={120} placeholder="Nazwa leku, np. ibuprofen" className="input max-w-md" />
        <button className="button-primary" type="submit"><T text="Wyszukaj"/></button>
      </form>
      {invalid && <p role="alert" className="notice-error mt-4"><T text="Wpisz nazwę leku, używając liter, cyfr, spacji lub podstawowych znaków interpunkcyjnych."/></p>}
      {results && (
        <div className="mt-8 grid gap-6">
          {results.map((result) => (
            <section key={result.kind} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title"><T text={result.kind === "drug_label" ? "Etykiety leków" : "Zgłoszenia zdarzeń niepożądanych"}/></h2>
                <span className="text-xs text-stone-500"><T text={{ok:"Dostępne",not_found:"Nie znaleziono",invalid_request:"Nieprawidłowa nazwa",unavailable:"Niedostępne"}[result.status]}/> · <T text={result.cached ? "Z pamięci podręcznej" : "Nowe wyszukiwanie"}/></span>
              </div>
              <p className="mt-3 text-xs text-stone-600"><T text="Źródło: openFDA."/> <T text={result.kind === "drug_event" ? "Liczby dotyczą zgłoszeń, nie ryzyka klinicznego." : "Etykiety mogą różnić się między produktami."}/></p>
              <pre className="mt-4 max-h-[38rem] overflow-auto rounded-xl bg-stone-950 p-4 text-xs leading-5 text-stone-100">{JSON.stringify(result, null, 2)}</pre>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
