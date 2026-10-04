import { LifeImpactSummary } from "@/components/life-impact-summary";
import { WomenReporting } from "@/components/women-reporting";
import { T, DateText } from "@/components/preferences-provider";
import { LabelSymptomBrowser } from "@/components/label-symptom-browser";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { DrugLabelSection } from "@/components/drug-label-section";
import { InformationCard } from "@/components/information-card";
import { PageHeading } from "@/components/page-heading";
import { Reveal } from "@/components/motion";
import { requireWorkspace } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTimeline, isDatabaseConfigured, listCycleCheckins, listCyclePeriods, listMedications } from "@/lib/db";
import { observedCycleDay } from "@/lib/cycle-context";
import { ensureMedicationSymptomIndex, type MedicationSymptomIndex } from "@/lib/classification/medication-index";
import { openFdaSource } from "@/lib/evidence/server";
import type { DrugEventData, DrugLabelData, DrugLabelRecord, EvidenceLookup } from "@/lib/evidence/types";
import type { CycleCheckin, CyclePeriod, Medication, TimelineItem } from "@/lib/models";
import { UUID_PATTERN } from "@/lib/validation";
import { SYMPTOM_GROUPS } from "@/lib/symptom-groups";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Co wiemy? | Side Effects Her",
  robots: { index: false, follow: false },
};

type Search = { med?: string };

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pl-PL", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(date);
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-medium text-evidence underline decoration-evidence/40 underline-offset-4 hover:decoration-evidence">{children}<span aria-hidden="true">↗</span></a>;
}

function EvidenceState({ result, subject }: { result: EvidenceLookup<unknown>; subject: string }) {
  const message = result.status === "not_found" ? `Dla tej nazwy leku nie znaleziono: ${subject}.`
    : result.status === "invalid_request" ? "Nie można wyszukać tej nazwy leku. Sprawdź zapis nazwy."
      : result.status === "unavailable" ? "openFDA jest chwilowo niedostępne. Spróbuj później."
        : null;
  if (!message) return null;
  return <div className="notice-attention"><p className="font-medium"><T text={"Niewystarczające informacje"}/></p><p className="mt-1"><T text={message}/></p></div>;
}

function SymptomExperience({ item, periods, checkins }: { item: Extract<TimelineItem, { kind: "symptom" }>; periods: CyclePeriod[]; checkins: CycleCheckin[] }) {
  const cycle = observedCycleDay(item.date, periods);
  const checkin = checkins.find((entry) => entry.observed_on === item.date);
  const sameDay = [checkin?.mood && `nastrój ${checkin.mood}/5`, checkin?.energy && `energia ${checkin.energy}/5`].filter(Boolean).join(" · ");
  return <div><h3 className="mt-1 font-medium text-foreground">{item.symptom}</h3><p className="mt-1 text-sm text-muted-foreground"><T text={"Twoja ocena nasilenia:"}/>{item.severity}/5.</p>{cycle && <p className="mt-1 text-xs text-primary"><T text={"Dzień"}/>{cycle.day}<T text={"od zapisanego początku krwawienia"}/></p>}{checkin && <p className="mt-1 text-xs text-muted-foreground"><T text={"Samopoczucie z tego dnia:"}/>{sameDay || "zapisany"}</p>}{item.note && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">{item.note}</p>}<LifeImpactSummary impacts={item.lifeImpacts} note={item.impactNote} /><Link href={`/context?event=${item.id}`} className="mt-2 inline-block text-sm text-link"><T text={"Dodaj kontekst"}/></Link></div>;
}

function Experience({ items, periods, checkins }: { items: TimelineItem[]; periods: CyclePeriod[]; checkins: CycleCheckin[] }) {
  return <InformationCard id="experience" tone="experience" number="01" eyebrow="TWOJE DOŚWIADCZENIE" title="Twoja historia. Twoje słowa." description="Zapisane daty i notatki w kolejności zdarzeń. Pokazują, kiedy coś się wydarzyło, bez przypisywania przyczyny.">
    {items.length ? <ol className="ml-3 border-l-2 border-timeline-line pl-6">
      {items.map((item) => <li key={`${item.kind}-${item.id}`} className="relative pb-7 last:pb-0">
        <span aria-hidden="true" className={`absolute -left-[33px] top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-secondary ${item.kind === "symptom" ? "bg-foreground" : item.kind === "baseline" ? "bg-evidence" : "bg-primary"}`} />
        <time className="eyebrow text-muted-foreground"><DateText value={item.date}/></time>
        {item.kind === "baseline" && <div><h3 className="mt-1 font-medium"><T text={"Przed rozpoczęciem leku"}/></h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p></div>}
        {item.kind === "medication" && <div><h3 className="mt-1 font-medium"><T text={"Rozpoczęcie leku"}/></h3><p className="mt-1 text-sm text-muted-foreground"><T text={"Zapisana dawka:"}/>{item.dose}</p></div>}
        {item.kind === "symptom" && <SymptomExperience item={item} periods={periods} checkins={checkins} />}
      </li>)}
    </ol> : <p className="rounded-xl bg-card p-5 text-sm text-muted-foreground"><T text={"Jeszcze bez obserwacji. Dodaj samopoczucie przed lekiem i kolejne wpisy na ekranie leków."}/></p>}
    <Link href="/cycle" className="mt-6 inline-flex min-h-11 items-center text-sm text-link"><T text={"Zapisz cykl i codzienny kontekst →"}/></Link>
  </InformationCard>;
}

function LabelCard({ label, index, medicationId }: { label: DrugLabelRecord; index: number; medicationId: string }) {
  const name = label.brandNames[0] ?? label.genericNames[0] ?? `Etykieta ${index + 1}`;
  const hasSections = Boolean(label.boxedWarnings.length || label.warnings.length || label.warningsAndCautions.length || label.adverseReactions.length);
  return <article className="rounded-[18px] border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="eyebrow text-evidence"><T text={"Etykieta leku FDA ·"}/>{index + 1}</p><h3 className="mt-1 text-lg font-semibold text-foreground">{name}</h3>{label.genericNames.length > 0 && <p className="mt-1 text-xs text-muted-foreground"><T text={"Nazwa generyczna:"}/>{label.genericNames.join(", ")}</p>}</div>
      {label.effectiveTime && <span className="pill bg-accent text-accent-foreground"><T text={"Data etykiety"}/><DateText value={label.effectiveTime}/></span>}
    </div>
    {label.productTypes.length > 0 && <p className="mt-3 text-xs text-muted-foreground"><T text={"Rodzaj produktu:"}/>{label.productTypes.join(", ")}</p>}
    <div className="mt-5 border-t border-border">
      <DrugLabelSection medicationId={medicationId} labelId={label.id} section="boxedWarnings" title="Wyróżnione ostrzeżenie" paragraphs={label.boxedWarnings} highlighted />
      <DrugLabelSection medicationId={medicationId} labelId={label.id} section="warnings" title="Ostrzeżenia" paragraphs={label.warnings} />
      <DrugLabelSection medicationId={medicationId} labelId={label.id} section="warningsAndCautions" title="Ostrzeżenia i środki ostrożności" paragraphs={label.warningsAndCautions} />
      <DrugLabelSection medicationId={medicationId} labelId={label.id} section="adverseReactions" title="Działania niepożądane — tekst etykiety" paragraphs={label.adverseReactions} />
      {!hasSections && <p className="py-4 text-sm text-muted-foreground"><T text={"W wybranych polach tej etykiety nie zwrócono tekstu o bezpieczeństwie."}/></p>}
    </div>
  </article>;
}

function OfficialInformation({ result, medicationId }: { result: EvidenceLookup<DrugLabelData>; medicationId: string }) {
  return <InformationCard id="official" tone="official" number="02" eyebrow="OFICJALNE INFORMACJE" title="Informacje u źródła." description="Informacje pochodzą z dopasowanych etykiet FDA. W polskiej wersji możesz czytać automatyczne tłumaczenie i rozwinąć oryginał. Sprawdź, czy opisany produkt odpowiada Twojemu.">
    {result.status === "ok" ? <>
      <p className="mb-5 rounded-xl border border-evidence/20 bg-card px-4 py-3 text-xs leading-5 text-accent-foreground"><T text={"Dopasowana nazwa:"}/><strong>{result.data.matchedNameVariant}</strong><T text={". Pokazano"}/>{result.data.labels.length} {result.data.totalMatchingLabels !== null ? <><T text="z"/>{result.data.totalMatchingLabels} <T text="dopasowanych"/></> : <T text={"dopasowanych"}/>}<T text={"etykiet. Różne postacie leku mogą mieć różne etykiety."}/></p>
      <div className="space-y-4">{result.data.labels.map((label, index) => <LabelCard key={label.id} label={label} index={index} medicationId={medicationId} />)}</div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span><T text={"Źródło: openFDA Drug Label"}/>{result.data.datasetLastUpdated && <><T text="· aktualizacja zbioru:"/><DateText value={result.data.datasetLastUpdated}/></>}</span>{result.sourceUrls.at(-1) && <SourceLink href={result.sourceUrls.at(-1)!}><T text={"Otwórz wyszukiwanie źródłowe"}/></SourceLink>}</div>

    </> : <><EvidenceState result={result} subject="dopasowana etykieta FDA" /><p className="mt-4 text-xs text-muted-foreground"><T text={"Źródło: openFDA Drug Label"}/></p></>}
  </InformationCard>;
}

function Limitations({ labels, events }: { labels: EvidenceLookup<DrugLabelData>; events: EvidenceLookup<DrugEventData> }) {
  const translations: Record<string, string> = {
    "Only up to three matching US drug-label records are returned; products and formulations may differ.": "Pokazujemy do trzech dopasowanych etykiet leków z USA. Produkty i postacie leku mogą się różnić.",
    "A missing label or section does not show that a medication or effect is safe or absent.": "Brak etykiety lub sekcji nie jest dowodem bezpieczeństwa ani braku danego działania.",
    "openFDA label records are source text, not a diagnosis or treatment recommendation.": "Etykiety openFDA są tekstem źródłowym. Nie stanowią diagnozy ani zalecenia leczenia.",
    "These are spontaneous adverse-event report counts, not incidence rates or individual risk estimates.": "To liczby spontanicznych zgłoszeń zdarzeń niepożądanych. Nie opisują częstości występowania ani indywidualnego ryzyka.",
    "A report mentioning a drug does not establish that the drug caused the reported event.": "Wymienienie leku w zgłoszeniu nie ustala, że lek spowodował opisane zdarzenie.",
    "Drug names in reports are not systematically normalized; matching may miss reports or include related product descriptions.": "Nazwy leków w zgłoszeniach nie są systematycznie ujednolicane. Wyszukiwanie może pominąć raporty lub dopasować pokrewne opisy produktów.",
    "Reported sex may be missing or unknown. Counts must not be treated as comparable exposure-adjusted rates.": "Płeć może być nieznana lub niepodana. Liczby nie uwzględniają liczby osób stosujących lek i nie pozwalają porównać ryzyka między grupami.",
    "Sex-stratified counts were not available for this lookup.": "Dla tego wyszukiwania nie uzyskano liczb raportów według płci.",
  };
  const caveats = [
    "Twoje daty pokazują kolejność zdarzeń. Sama kolejność nie ustala, czy lek spowodował objaw.",
    "Klasyfikacja AI może pominąć lub błędnie pogrupować opis. Sprawdź cytat i oryginalną etykietę przed wykorzystaniem go w rozmowie z lekarzem.",
    ...labels.limitations.map((text) => translations[text] ?? text),
    ...events.limitations.map((text) => translations[text] ?? text),
  ];
  return <InformationCard id="limitations" tone="limitations" number="04" eyebrow="OGRANICZENIA" title="Czego nie wiemy." description="Ten widok pomaga uporządkować rozmowę z lekarzem. Nie diagnozuje, nie szacuje ryzyka i nie zaleca zmian leczenia.">
    <ul className="grid gap-3 sm:grid-cols-2">{caveats.map((caveat) => <li key={caveat} className="rounded-xl border border-border bg-card px-4 py-4 text-sm leading-6 text-muted-foreground"><span aria-hidden="true" className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground text-xs font-semibold"><T text={"i"}/></span><T text={caveat}/></li>)}</ul>
    <p className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground"><T text={"Własne zapisy: Twój dziennik. Informacje zewnętrzne: openFDA Drug Label i Drug Event. AI grupuje dokładne fragmenty etykiety i przygotowuje pomocnicze tłumaczenia. Nie ocenia Twojego zdrowia. Oryginał FDA pozostaje źródłem informacji."}/></p>
  </InformationCard>;
}

function WomenEvidence({ labels, events }: { labels: EvidenceLookup<DrugLabelData>; events: EvidenceLookup<DrugEventData> }) {
  const sexCountsAvailable = events.status === "ok" && events.data.sexCountStatus === "available" && Boolean(events.data.reportedSexCounts?.length);
  const eventsUnavailable = events.status === "unavailable" || events.status === "invalid_request" || (events.status === "ok" && events.data.sexCountStatus === "unavailable");
  const rows = [
    { label: "Liczby raportów według płci", status: sexCountsAvailable ? "Dostępne" : eventsUnavailable ? "Niedostępne" : "Nie znaleziono", detail: sexCountsAvailable ? "Surowe liczby z pola płci w zgłoszeniach." : eventsUnavailable ? "Nie udało się pobrać podziału według płci. Spróbuj później." : "Brak podziału dla tego wyszukiwania." },
    { label: "Informacje o płci w etykietach", status: "Nie oceniono", detail: labels.status === "ok" ? "Sprawdź oryginalne etykiety dotyczące danego produktu." : labels.status === "not_found" ? "Nie znaleziono dopasowanej etykiety dla tej nazwy." : "Nie udało się pobrać etykiet. Informacji o płci nie oceniono." },
    { label: "Badania naukowe", status: "Nie oceniono", detail: "Literatura naukowa nie jest podłączona do tego MVP." },
  ];
  return <section aria-labelledby="women-evidence-title" className="card"><p className="eyebrow text-evidence"><T text={"INFORMACJE DOTYCZĄCE KOBIET"}/></p><h2 id="women-evidence-title" className="mt-2 text-xl font-semibold text-foreground sm:text-2xl"><T text={"Co wiemy o kobietach?"}/></h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground"><T text={"Źródła obejmują różne rodzaje informacji. Brakujące lub nieprzeanalizowane dane nie są dowodem braku działania."}/></p><dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-card px-4 sm:px-5">{rows.map((row) => <div key={row.label} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><dt className="text-sm font-medium text-foreground"><T text={row.label}/></dt><dd className="mt-1 text-xs text-muted-foreground"><T text={row.detail}/></dd></div><span className={`pill ${row.status === "Dostępne" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}><T text={row.status}/></span></div>)}</dl></section>;
}

export default async function WhatWeKnow({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  if (!isDatabaseConfigured()) return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Side Effects Her"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Aby wyświetlić zapisy, potrzebne jest połączenie z bazą danych."}/></p><Link href="/" className="mt-5 inline-block text-link"><T text={"Wróć do historii"}/></Link></main>;
  const workspace = await requireWorkspace();

  let medications: Medication[];
  try { medications = await listMedications(workspace); }
  catch (error) { console.error("Medication load failed", error); return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Side Effects Her"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Zapisy są chwilowo niedostępne. Spróbuj odświeżyć stronę później."}/></p></main>; }
  const selected = medications.find((medication) => medication.id === search.med) ?? medications[0];
  if (!selected) return <main className="page-shell text-center"><p className="eyebrow text-primary"><T text={"Side Effects Her"}/></p><h1 className="mt-3 text-3xl font-semibold"><T text={"Co wiemy?"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Dodaj lek, aby zobaczyć własną historię obok dostępnych informacji ze źródeł."}/></p><Link href="/" className="button-primary mt-7"><T text={"Dodaj lek"}/></Link></main>;

  let timeline: TimelineItem[];
  let periods: CyclePeriod[];
  let checkins: CycleCheckin[];
  try { [timeline, periods, checkins] = await Promise.all([getTimeline(workspace, selected.id), listCyclePeriods(workspace), listCycleCheckins(workspace)]); }
  catch (error) { console.error("Timeline load failed", error); return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Side Effects Her"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Historia jest chwilowo niedostępna. Spróbuj odświeżyć stronę później."}/></p></main>; }
  const source = openFdaSource();
  const [labels, events] = await Promise.all([source.lookupLabels(selected.name), source.lookupEvents(selected.name)]);
  let index: MedicationSymptomIndex | null = null;
  try { index = await ensureMedicationSymptomIndex(workspace, selected, labels); }
  catch (error) { console.error("Medication symptom index failed", error); }

  return <main className="page-shell">
    <PageHeading eyebrow="Źródła i Twoje obserwacje" title="Co wiemy?" accent="Spójrzmy osobno."><p><T text={"Twoje doświadczenie i dostępne informacje źródłowe w odrębnych sekcjach. Pomagają przygotować pytania do lekarza, ale nie ustalają przyczyny objawu."}/></p></PageHeading><div className="mb-5 flex flex-wrap items-center gap-3"><span className="source-pill">{selected.name}</span><span className="text-xs leading-6 text-muted-foreground">{selected.dose}<T text={"· rozpoczęcie:"}/><DateText value={selected.started_on}/></span></div>
    {medications.length > 1 && <nav aria-label="Wybierz lek" className="mt-5 flex flex-wrap gap-2">{medications.map((medication) => <Link key={medication.id} href={`/what-we-know?med=${medication.id}`} aria-current={selected.id === medication.id ? "page" : undefined} className={`pill min-h-9 ${selected.id === medication.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}>{medication.name}</Link>)}</nav>}
    <nav aria-label="Sekcje na tej stronie" className="mt-6 flex flex-wrap gap-2">{[["experience", "Twoje doświadczenie"], ["official", "Oficjalne informacje"], ["reports", "Zgłoszenia z praktyki"], ["limitations", "Ograniczenia"]].map(([id, label]) => <a key={id} href={`#${id}`} className="pill min-h-10 border border-border bg-card text-muted-foreground hover:text-primary"><T text={label}/></a>)}</nav>
    {labels.status === "ok" && <div className="mt-6"><LabelSymptomBrowser medicationId={selected.id} sources={index?.sources ?? []} labels={labels.data.labels} timeline={timeline} available={index?.state?.status !== "unavailable" && Boolean(index)} /></div>}
    <div className="evidence-overview mt-6"><Reveal><Experience items={timeline} periods={periods} checkins={checkins} /></Reveal><Reveal><OfficialInformation result={labels} medicationId={selected.id} /></Reveal><Reveal><WomenReporting result={events} /></Reveal><Reveal><Limitations labels={labels} events={events} /></Reveal><Reveal><WomenEvidence labels={labels} events={events} /></Reveal></div>
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground"><span><T text={"Side Effects Her · Materiał do rozmowy z lekarzem. Bez diagnozy i zaleceń leczenia."}/></span><Link href={`/timeline?med=${selected.id}`} className="text-link"><T text={"Wróć do historii"}/></Link></footer>
  </main>;
}



