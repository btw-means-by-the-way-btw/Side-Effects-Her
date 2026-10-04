"use client";
import { useState } from "react";
import Link from "next/link";
import type { CycleCheckin, CyclePeriod, Medication, PersonalObservation, TimelineItem } from "@/lib/models";
import { compareMedicationDays, comparableCycleDays, observationKey } from "@/lib/personal-pattern";
import { groupLabel } from "@/lib/symptom-groups";
import { validIsoDate } from "@/lib/daily";
import { DateText, useLocale } from "./preferences-provider";
import { LifeImpactSummary } from "./life-impact-summary";
import styles from "./personal-normal.module.css";

type Props = { medications: Medication[]; selected: Medication | null; observations: PersonalObservation[]; periods: CyclePeriod[]; checkins: CycleCheckin[]; cycleMode: string; baseline: Extract<TimelineItem, { kind: "baseline" }>[]; today: string };

export function PersonalNormal({ medications, selected, observations, periods, checkins, cycleMode, baseline, today }: Props) {
  const en = useLocale() === "en", locale = en ? "en" : "pl";
  const say = (pl: string, english: string) => en ? english : pl;
  const options = [...new Map(observations.filter(item => validIsoDate(item.date) && item.date <= today).map(item => {
    const key = observationKey(item);
    return [key, key.startsWith("group:") ? groupLabel(key.slice(6), locale) ?? item.symptom : item.symptom];
  })).entries()];
  const [key, setKey] = useState(options[0]?.[0] ?? "");
  const [date, setDate] = useState(today);
  const comparison = selected && key ? compareMedicationDays(observations, key, selected.started_on, today) : null;
  const cycle = comparableCycleDays(date, periods, cycleMode, today);
  const validDate = validIsoDate(date) && date <= today;
  const matches = (day: string) => observations.filter(item => item.date === day && observationKey(item) === key);
  function Records({ items }: { items: PersonalObservation[] }) {
    return items.length ? <ol className={styles.records}>{items.slice().sort((a, b) => b.date.localeCompare(a.date)).map(item => <li key={item.id}>
      <div className={styles.recordTop}><DateText value={item.date} /><span>{say("Nasilenie", "Severity")} {item.severity}/5</span></div>
      <Link href={`/context?event=${item.id}`}>{item.symptom} <span aria-hidden="true">↗</span></Link>
      <small>{say("Zapis przy leku:", "Recorded with medication:")} {item.medicationName}</small>
      {item.note && <p className={styles.ownNote}>{item.note}</p>}
      <LifeImpactSummary impacts={item.lifeImpacts} note={item.impactNote} />
    </li>)}</ol> : <p className={styles.missing}>{say("Brak wpisów w dostępnej historii. Nie oznacza to braku objawu.", "No entries in the available history. This does not mean the symptom was absent.")}</p>;
  }
  function DayContext({ day }: { day: string }) {
    const checkin = checkins.find(item => item.observed_on === day);
    const answers = checkin ? [checkin.mood !== null ? `${say("Nastrój", "Mood")} ${checkin.mood}/5` : null,
      checkin.energy !== null ? `${say("Energia", "Energy")} ${checkin.energy}/5` : null,
      checkin.sleep_hours !== null ? `${say("Sen", "Sleep")} ${checkin.sleep_hours} h` : null,
      checkin.hydration ? `${say("Woda", "Water")}: ${({ less: say("mniej niż zwykle", "less than usual"), usual: say("jak zwykle", "as usual"), more: say("więcej niż zwykle", "more than usual"), unsure: say("nie jestem pewna", "unsure") })[checkin.hydration]}` : null,
      checkin.meals_regular ? `${say("Regularne posiłki", "Regular meals")}: ${({ yes: say("tak", "yes"), no: say("nie", "no"), unsure: say("nie jestem pewna", "unsure") })[checkin.meals_regular]}` : null].filter(Boolean) : [];
    return <div className={styles.dayContext}><h4>{say("Twój zapis samopoczucia", "Your check-in")}</h4>{answers.length ? <div className={styles.contextTags}>{answers.map(answer => <span key={answer}>{answer}</span>)}</div> : <p>{say("Brak odpowiedzi o samopoczuciu dla tej daty.", "No wellbeing answers for this date.")}</p>}{checkin?.note && <p className={styles.ownNote}>{checkin.note}</p>}</div>;
  }
  return <div className={styles.root}>
    <Link className="text-button" href={selected ? `/?med=${selected.id}` : "/"}>{say("← Twoje leki", "← Your medications")}</Link>
    <header className={styles.hero}><div><p className="eyebrow">{say("Twój osobisty punkt odniesienia", "Your personal reference point")}</p><h1>{say("Moja", "My")} <em>{say("norma.", "normal.")}</em></h1><p>{say("Jak wyglądały Twoje dni wcześniej? Zestaw własne obserwacje z początkiem leku i kontekstem cyklu.", "What were your days like before? Put your own observations alongside your medication start and cycle context.")}</p></div><div className={styles.orbit} aria-hidden="true"><span /><span /><span /><i>✧</i></div></header>
    {!selected ? <section className="card"><h2 className="section-title">{say("Zacznij od swojego zapisu.", "Start with your own record.")}</h2><p className="section-copy">{say("Dodaj lek i samopoczucie przed jego rozpoczęciem. Nie tworzymy przykładowych wyników.", "Add a medication and your pre-treatment baseline. We do not create example findings.")}</p><Link className="button-primary" href="/">{say("Dodaj lek", "Add medication")}</Link></section> : <>
      <nav className="medication-selector" aria-label={say("Wybierz lek", "Choose medication")}>{medications.map(m => <Link key={m.id} href={`/my-normal?med=${m.id}`} aria-current={m.id === selected.id ? "page" : undefined}>{m.name}</Link>)}</nav>
      <section className={styles.reference}><div><p className="step">{say("Punkt odniesienia", "Reference point")}</p><h2>{selected.name} <span>· {selected.dose}</span></h2><p>{say("Zapisane rozpoczęcie:", "Recorded start:")} <DateText value={selected.started_on} /></p></div><label className={styles.picker}>{say("Co chcesz porównać?", "What would you like to compare?")}<select className="input" value={key} onChange={event => setKey(event.target.value)} disabled={!options.length}>{options.length ? options.map(([value, label]) => <option value={value} key={value}>{label}</option>) : <option value="">{say("Jeszcze bez zapisanych objawów", "No symptoms recorded yet")}</option>}</select></label></section>
      <p className={styles.caption}>{say("Korzystamy z Twoich potwierdzonych zapisów przy wszystkich lekach. Grupy łączą podobne opisy, nie diagnozy.", "We use your confirmed records across all medications. Groups connect similar descriptions, not diagnoses.")}</p>
      {comparison ? <>
        <div className={styles.comparison}>{[{ title: say("Przed rozpoczęciem", "Before starting"), subtitle: say("28 poprzednich dni", "28 preceding days"), from: comparison.beforeFrom, to: comparison.beforeTo, days: comparison.beforeDays, items: comparison.before }, { title: say("Od rozpoczęcia", "From the start"), subtitle: say("Pierwsze 28 dni, do dzisiaj", "First 28 days, up to today"), from: comparison.afterFrom, to: comparison.afterTo, days: comparison.afterDays, items: comparison.after }].map((part, index) => <section className={`${styles.panel} ${index ? styles.after : ""}`} key={index}>
          <p className="step">{index ? "02" : "01"} · {part.subtitle}</p><h2>{part.title}</h2>
          <p className={styles.range}>{part.from <= part.to ? <><DateText value={part.from} /> — <DateText value={part.to} /></> : say("Ten okres jeszcze się nie rozpoczął.", "This period has not started yet.")}</p>
          <div className={styles.dayCount}><strong>{part.days}</strong><span>{say(part.days === 1 ? "dzień z zapisem tego opisu" : "dni z zapisem tego opisu", part.days === 1 ? "day with this description recorded" : "days with this description recorded")}<small>{say("Liczba wpisanych dni, nie częstość objawu", "Recorded days, not symptom frequency")}</small></span></div>
          <Records items={part.items} />
        </section>)}</div>
        <div className={styles.insight}><span aria-hidden="true">✧</span><p>{comparison.priorHistory.length ? say("W Twojej historii jest wcześniejszy zapis podobnego opisu — przed rozpoczęciem tego leku. To punkt odniesienia do rozmowy, bez wniosku o przyczynie.", "Your history contains an earlier record of a similar description, before this medication started. It is a reference for discussion, without a conclusion about cause.") : say("Nie ma wcześniejszego zapisu tego opisu. Nie wiemy, czy objaw występował wcześniej — brak wpisów nie dowodzi, że jest nowy.", "There is no earlier record of this description. We do not know if it happened before; missing records do not prove it is new.")}</p></div>
      </> : <section className="card"><h2 className="section-title">{say("Twoja norma potrzebuje Twoich obserwacji.", "Your normal starts with your observations.")}</h2><p className="section-copy">{say("Gdy zapiszesz objaw, zobaczysz jego dostępne wpisy przed i po rozpoczęciu leku.", "Once you record a symptom, you will see its available entries before and after medication start.")}</p><Link className="button-quiet" href={`/?med=${selected.id}`}>{say("Zapisz obserwację", "Record an observation")}</Link></section>}
      <section className={styles.baseline}><p className="step">{say("Twoje słowa, sprzed leku", "Your words, before medication")}</p><h2>{say("Jak czułaś się wcześniej?", "How did you feel before?")}</h2>{baseline.length ? baseline.map(item => <blockquote key={item.id}><p>{item.description}</p><footer><DateText value={item.date} /></footer></blockquote>) : <p className={styles.missing}>{say("Nie masz jeszcze zapisanego punktu wyjścia dla tego leku.", "You have not recorded a baseline for this medication yet.")}</p>}</section>
      <section className={`${styles.panel} ${styles.cycle}`}><div className={styles.cycleHeading}><div><p className="step">{say("Kontekst, nie wyjaśnienie", "Context, not an explanation")}</p><h2>{say("Ten sam dzień w Twoich cyklach", "The same day in your cycles")}</h2></div><label className={styles.picker}>{say("Dzień do sprawdzenia", "Day to explore")}<input className="input" type="date" value={date} max={today} onChange={event => setDate(event.target.value)} onInput={event => setDate(event.currentTarget.value)} /></label></div>
        <p className={styles.caption}>{say("Porównujemy numer dnia od zapisanego początku krwawienia. To nie oznacza tej samej fazy hormonalnej ani ustalonej owulacji.", "We compare the day number from recorded bleeding onset. This does not mean the same hormonal phase or confirmed ovulation.")}</p>
        {validDate ? <div className={styles.selectedDay}><h3>{say("Wybrany dzień", "Selected day")} · <DateText value={date} /></h3>{key && <Records items={matches(date)} />}<DayContext day={date} /></div> : <p role="status" className={styles.missing}>{say("Wybierz poprawną datę, najpóźniej dzisiejszą.", "Choose a valid date, no later than today.")}</p>}
        {cycle.status === "available" ? <><p className={styles.cycleDay}>{say("Dzień", "Day")} <strong>{cycle.day}</strong> {say("od zapisanego początku krwawienia", "from recorded bleeding onset")}</p><div className={styles.previousDays}>{cycle.dates.map(day => <article key={day}><p className="step">{say("Poprzedni zapis cyklu", "Previous cycle record")}</p><h3><DateText value={day} /></h3>{key && <Records items={matches(day)} />}<DayContext day={day} /></article>)}</div></> : <div className={styles.missing}><strong>{say("Za mało informacji do porównania cykli", "Insufficient information to compare cycles")}</strong><p>{cycle.reason === "context" ? say("Najpierw określ kontekst cyklu w sekcji Cykl. Przy nieznanym lub zmienionym kontekście nie porównujemy numerów dni.", "First set your cycle context in Cycle. We do not compare day numbers when the context is unknown or affected.") : say("Potrzebne są co najmniej dwa zapisane początki krwawienia i pasujący numer dnia. Luki i różne długości cykli mogą uniemożliwić porównanie.", "At least two recorded bleeding starts and a matching day number are needed. Gaps and different cycle lengths can prevent a comparison.")} <Link href={`/cycle?med=${selected.id}`}>{say("Zajrzyj do cyklu ↗", "Explore your cycle ↗")}</Link></p></div>}
      </section>
      <footer className={styles.limitations}><p className="step">{say("Co warto wiedzieć", "Keep in mind")}</p><p>{say("„Norma” oznacza Twoją dostępną historię, nie normę medyczną. Dni bez wpisu są nieznane. Zapisy samopoczucia obejmują maksymalnie 90 ostatnich wpisów, daty krwawienia — 24 ostatnie zapisy. Widok nie ustala przyczyny ani nie zaleca zmian leczenia.", "“Normal” means your available history, not a medical norm. Days without entries are unknown. Check-ins cover up to 90 recent entries and bleeding dates up to 24 records. This view does not determine causes or recommend treatment changes.")}</p><small>{say("Źródło: Twoje potwierdzone zapisy w Side Effects Her.", "Source: your confirmed Side Effects Her records.")}</small></footer>
    </>}
  </div>;
}
