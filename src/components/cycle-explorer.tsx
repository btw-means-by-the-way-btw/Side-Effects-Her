"use client";
import { T, DateText } from "@/components/preferences-provider";
import { LocalizedOption, LocalizedInput } from "@/components/localized-fields";


import { useState } from "react";
import type { CyclePeriod, CycleProfile } from "@/lib/models";
import { CYCLE_SOURCES, ESTIMATE_REASONS, cyclePhase, estimateCycle, type CycleMode } from "@/lib/cycle-estimate";
import { observedCycleDay } from "@/lib/cycle-context";
import { dateLabel } from "@/lib/display";
import { recordCycleProfile } from "@/app/actions";
import { EntrySheet } from "./entry-sheet";
import { SaveButton } from "./save-button";
import { Icon } from "./icon";
import {useLocale} from "./preferences-provider";

function addDays(date: string, days: number): string { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function formatShortDate(date: string, locale: string): string { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pl-PL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
const inRange = (date: string, range: { from: string; to: string }) => date >= range.from && date <= range.to;
const phaseLabels = { menstrual: "Miesiączka", follicular: "Faza folikularna", ovulation: "Owulacja", luteal: "Faza lutealna" };
const stageLabels = { menstrual: "Miesiączka · zapisane krwawienie", follicular: "Faza folikularna · szacunek", ovulation: "Owulacja · możliwy zakres", luteal: "Faza lutealna · szacunek" };

function ProfileForm({ profile, med }: { profile: CycleProfile | null; med?: string }) {
  const [mode, setMode] = useState<CycleMode>(profile?.mode ?? "unknown");
  return <form action={recordCycleProfile} className="space-y-5">
    <input type="hidden" name="return_medication_id" value={med ?? ""} />
    <div><label htmlFor="cycle-mode" className="label"><T text={"Który opis pasuje obecnie do Twojej sytuacji?"}/></label>
      <select id="cycle-mode" name="mode" value={mode} onChange={event => setMode(event.target.value as CycleMode)} className="input">
        <LocalizedOption value="unknown">Nie wiem / pokazuj tylko moje zapisy</LocalizedOption>
        <LocalizedOption value="affected">Hormony, nieregularne cykle lub inny wpływ na cykl</LocalizedOption>
        <LocalizedOption value="natural">Regularne, naturalne cykle — chcę szacunek kalendarzowy</LocalizedOption>
      </select>
    </div>
    {mode === "natural" && <div><label htmlFor="usual-length" className="label"><T text={"Zwykła długość Twojego cyklu (opcjonalnie)"}/></label><LocalizedInput id="usual-length" name="usual_length" type="number" min={21} max={35} step={1} defaultValue={profile?.usual_length ?? ""} className="input"/><p className="section-copy"><T text={"Licz od pierwszego dnia miesiączki do dnia przed kolejną. Jeśli ją znasz, mapa może pokazać wstępny szacunek już po jednym zapisie. To Twoje założenie, nie pomiar."}/></p></div>}
    <p className="notice"><T text={"Krwawienie podczas terapii hormonalnej nie pozwala ustalić owulacji. Jeśli nie wiesz, czy Twój lek wpływa na cykl, wybierz „Nie wiem” i omów to z lekarzem lub farmaceutą."}/></p>
    {mode === "natural" && <label className="profile-confirmation"><LocalizedInput type="checkbox" name="natural_confirmed" required /><span><T text={"Potwierdzam, że zapisuję naturalne miesiączki, mam regularne cykle, nie stosuję antykoncepcji hormonalnej ani terapii hormonalnej i nie jestem w ciąży, połogu, okresie karmienia ani perimenopauzie. Rozumiem, że szacunek nie potwierdza owulacji i nie służy do antykoncepcji."}/></span></label>}
    <p className="text-xs leading-6 text-muted-foreground"><T text={"To Twoja deklaracja, nie ocena aplikacji. Pozostaje zapisana po dodaniu leku. Zaktualizuj ją, jeśli zmieniła się Twoja sytuacja lub leczenie wpływające na cykl."}/></p>
    <SaveButton><T text={"Zapisz kontekst cyklu"}/></SaveButton>
  </form>;
}

export function CycleExplorer({ periods, profile, medicationsUnchanged, initialDate, med }: { periods: CyclePeriod[]; profile: CycleProfile | null; medicationsUnchanged: boolean; initialDate: string; med?: string }) {
  const locale=useLocale();
  const shortDate = (date: string) => formatShortDate(date, locale);
  const [selected, setSelected] = useState(initialDate);
  const knownPeriods = periods.filter(period => period.started_on <= initialDate);
  const estimate = estimateCycle(selected, knownPeriods, profile?.mode ?? "unknown", profile?.usual_length ?? null);
  const phase = cyclePhase(selected,knownPeriods,estimate);
  const observed = observedCycleDay(selected, knownPeriods);
  const latestStart = periods.filter(period => period.started_on <= initialDate).sort((a, b) => b.started_on.localeCompare(a.started_on))[0]?.started_on;
  const dates = latestStart ? Array.from({ length: 35 }, (_, index) => addDays(latestStart, index)) : [];
  // The map always uses the same current cycle model; clicking a future date cannot reveal future records.
  const mapEstimate = estimateCycle(initialDate, periods.filter(period => period.started_on <= initialDate), profile?.mode ?? "unknown", profile?.usual_length ?? null);
  return <section className="card cycle-explorer" aria-labelledby="cycle-map-title">
    <div className="explorer-heading"><div><p className="step"><T text={"Zapisy i orientacja"}/></p><h2 id="cycle-map-title" className="section-title"><T text={"Mapa Twojego cyklu."}/></h2></div><span className="pill bg-secondary text-primary">{mapEstimate.status === "estimated" ? <T text={"Orientacyjny model"}/> : <T text={"Twoje obserwacje"}/>}</span></div>
    <p className="section-copy"><T text={"Wybierz dzień. Zapisane krwawienie pokazujemy osobno od szacunków. Nie mierzymy hormonów ani nie potwierdzamy owulacji."}/></p>
    <div className="phase-rail">{(["menstrual","follicular","ovulation","luteal"] as const).map((name,index)=><article key={name} className={`phase-tile ${name} ${phase===name?"selected":""}`} aria-current={phase===name?"step":undefined}><span className="phase-number">0{index+1}</span><h3><T text={phaseLabels[name]}/></h3><p>{locale==="en"?["Recorded bleeding","Before possible ovulation","Uncertain ovulation window","After possible ovulation"][index]:["Zapisane krwawienie","Przed możliwą owulacją","Niepewny zakres owulacji","Po możliwej owulacji"][index]}</p><small>{phase===name?(locale==="en"?"Selected day":"Wybrany dzień"):(locale==="en"?"Cycle stage":"Etap cyklu")}</small></article>)}</div>
    <p className="section-copy">{locale==="en"?<T text={"Four stages for orientation. Menstrual marks recorded bleeding and overlaps the follicular phase. Other stages are calendar assumptions, not hormone measurements."}/>:<T text={"Cztery etapy dla orientacji. Miesiączka oznacza zapisane krwawienie i nakłada się biologicznie na fazę folikularną. Pozostałe etapy to założenia kalendarzowe, nie pomiar hormonów."}/>}</p>
    <EntrySheet title="Kontekst ma znaczenie." description="Włącz orientacyjne szacunki tylko wtedy, gdy warunki pasują do Twojej sytuacji." trigger={profile ? "Sprawdź kontekst cyklu" : "Określ kontekst cyklu"} triggerClass="button-quiet"><ProfileForm profile={profile} med={med} /></EntrySheet>
    {profile && <p className="mt-3 text-xs text-muted-foreground"><T text={"Twoja deklaracja z"}/><DateText value={profile.confirmed_at}/>: {profile.mode === "natural" ? <T text={"regularny, naturalny cykl"}/> : profile.mode === "affected" ? <T text={"czynniki wpływające na cykl"}/> : <T text={"kontekst niepewny"}/>}.</p>}
    {profile && !medicationsUnchanged && <p className="section-copy mt-3"><T text={"Lista leków zmieniła się od zapisania kontekstu. Mapa nadal korzysta z Twojej deklaracji i dat. Jeśli rozpoczęłaś terapię hormonalną lub zmieniła się Twoja sytuacja, zaktualizuj kontekst cyklu. Aplikacja nie ocenia wpływu leku na cykl."}/></p>}
    {dates.length > 0 && <>
      <div className="cycle-day-map" role="group" aria-label={locale === "en" ? "Days from the last recorded bleeding start" : "Dni od ostatniego zapisanego początku krwawienia"}>{dates.map((date, index) => {
        const bleeding = observedCycleDay(date, periods)?.bleedingRecorded;
        const ovulation = mapEstimate.status === "estimated" && inRange(date, mapEstimate.ovulation);
        const window = mapEstimate.status === "estimated" && inRange(date, mapEstimate.possibleFertileWindow);
        const label = locale === "en" ? `${shortDate(date)}, day ${index + 1}${bleeding ? ", recorded bleeding" : ""}${ovulation ? ", estimated ovulation range" : ""}${window ? ", in the estimated possible fertile window" : ""}` : `${dateLabel(date)}, dzień ${index + 1}${bleeding ? ", zapisane krwawienie" : ""}${ovulation ? ", orientacyjny zakres owulacji" : ""}${window ? ", w orientacyjnym oknie możliwej płodności" : ""}`;
        return <button key={date} type="button" aria-pressed={selected === date} aria-label={label} className={`cycle-day ${bleeding ? "recorded" : ""} ${window ? "window" : ""} ${ovulation ? "ovulation" : ""}`} onClick={() => setSelected(date)}><span>{index + 1}</span><small>{shortDate(date)}</small></button>;
      })}</div>
      <div className="cycle-map-legend"><span><i className="recorded" /><T text={"Zapisane krwawienie"}/></span>{mapEstimate.status === "estimated" && <><span><i className="window" /><T text={"Orientacyjne okno możliwej płodności"}/></span><span><i className="ovulation" /><T text={"Zakres możliwej owulacji"}/></span></>}</div>
    </>}
    <div className="mt-6"><label htmlFor="explore-cycle-date" className="label"><T text={"Sprawdź dzień"}/></label><LocalizedInput id="explore-cycle-date" type="date" required value={selected} onInput={event => { if (event.currentTarget.value) setSelected(event.currentTarget.value); }} onChange={event => { if (event.target.value) setSelected(event.target.value); }} className="input max-w-xs" /></div>
    <div className="cycle-day-detail" aria-live="polite" aria-atomic="true">
      <p className="eyebrow text-primary"><DateText value={selected}/></p><h3>{observed ? <T text={`Dzień ${observed.day} od zapisanego początku`}/> : <T text={"Bez zapisanego początku cyklu"}/>}</h3>
      {observed?.bleedingRecorded && <p className="recorded-fact"><Icon name="check" /><T text={"Krwawienie zapisane przez Ciebie."}/></p>}
      {estimate.status === "estimated" ? <>
        <div className="cycle-estimate-grid">
          <article><p className="step"><T text={"Orientacyjny etap"}/></p><h4>{phase ? <T text={stageLabels[phase]}/> : <T text="Nieznane"/>}</h4><p><T text={"Etap wynika z dat, nie z pomiaru hormonów. Owulacja mogła wystąpić w innym terminie albo nie wystąpić."}/></p></article>
          <article><p className="step"><T text={"Możliwa owulacja · zakres"}/></p><h4>{shortDate(estimate.ovulation.from)} – {shortDate(estimate.ovulation.to)}</h4><p><T text={"Nie wskazujemy jednego dnia jako pewnej daty owulacji."}/></p></article>
          <article><p className="step"><T text={"Płodność tego dnia"}/></p><h4>{inRange(selected, estimate.possibleFertileWindow) ? <T text={"W orientacyjnym oknie możliwej płodności"}/> : <T text={"Poza orientacyjnym oknem · płodność nieznana"}/>}</h4><p><T text={"Nie określamy prawdopodobieństwa ciąży. Poza tym zakresem ciąża nadal jest możliwa."}/></p></article>
        </div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">{estimate.basis==="declared" ? (locale === "en" ? `Preliminary estimate using your stated ${profile?.usual_length}-day length (expanded by ±2 days) and available records. This is an assumption, not a measured cycle. ` : `Wstępny szacunek na podstawie podanej długości ${profile?.usual_length} dni (poszerzonej o ±2 dni) i dostępnych zapisów. To założenie, nie wyznaczony cykl. `) : (locale === "en" ? `Based on ${estimate.intervalCount} recorded intervals. ` : `Podstawa: ${estimate.intervalCount} zapisanych odstępów. `)}<T text={"Zakres:"}/>{estimate.shortest}–{estimate.longest} <T text={"dni. Orientacyjny kolejny początek:"}/>{shortDate(estimate.nextBleeding.from)} – {shortDate(estimate.nextBleeding.to)}<T text={". Model może się mylić."}/></p>
      </> : <div className="notice mt-4"><strong><T text={"Niewystarczające informacje do szacunku"}/></strong><p className="mt-2"><T text={ESTIMATE_REASONS[estimate.reason]}/></p><p className="mt-2"><T text={"Owulacja, płodność i etap hormonalny: nieznane."}/></p></div>}
    </div>
    <p className="notice-attention mt-5"><T text={"Ta mapa nie jest metodą antykoncepcji ani narzędziem planowania ciąży. Nie pokazuje „bezpiecznych dni”."}/></p>
    <details className="cycle-method"><summary><T text={"Jak powstaje szacunek i co oznaczają hormony?"}/></summary><div>
      <p><T text={"W naturalnym cyklu estrogen wspiera rozwój i uwolnienie komórki jajowej, a po owulacji progesteron wspiera przygotowanie błony śluzowej macicy. Te informacje opisują ogólny mechanizm, nie Twój zmierzony poziom hormonów."}/></p>
      <p><T text={"Zakres możliwej owulacji obliczamy 10–16 dni przed zakresem kolejnego początku miesiączki wynikającym z ostatnich odstępów. Okno możliwej płodności rozszerzamy o 7 dni przed tym zakresem i jeden dzień po nim. To szeroka ilustracja kalendarzowa, nie zwalidowany model indywidualnej płodności."}/></p>
      <p><T text={"Przy trzech pełnych odstępach model korzysta z historii. Wcześniej możesz podać swoją zwykłą długość (21–35 dni); rozszerzamy ją o ±2 dni jako ilustrację niepewności. To umowne warunki MVP, nie kryteria zdrowia ani zwalidowany przedział ufności. Nie używamy domyślnego cyklu 28 dni."}/></p>
      <a className="text-link" href={CYCLE_SOURCES.cycle} target="_blank" rel="noopener noreferrer"><T text={"Źródło: NHS — cykl i owulacja ↗"}/></a><br /><a className="text-link" href={CYCLE_SOURCES.fertility} target="_blank" rel="noopener noreferrer"><T text={"NHS — ograniczenia śledzenia płodności ↗"}/></a>
    </div></details>
    <div className="cycle-wellbeing"><Icon name="wave" /><div><h3><T text={"Samopoczucie też ma kontekst."}/></h3><p><T text={"NHS opisuje, że przed miesiączką mogą występować m.in. zmiany nastroju, zmęczenie lub ból głowy. To nie oznacza, że cykl wyjaśnia Twój objaw. Zapisuj obserwacje obok leków, snu i codziennych okoliczności."}/></p><a className="text-link" href={CYCLE_SOURCES.wellbeing} target="_blank" rel="noopener noreferrer"><T text={"Źródło: NHS — objawy przed miesiączką ↗"}/></a></div></div>
  </section>;
}
