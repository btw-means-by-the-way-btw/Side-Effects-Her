"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import type { CycleCheckin, CyclePeriod, Medication, PersonalObservation } from "@/lib/models";
import { buildChartDays, chartWindow, recordedRating } from "@/lib/personal-chart";
import { addPatternDays, observationKey } from "@/lib/personal-pattern";
import { groupLabel } from "@/lib/symptom-groups";
import { medicationColor } from "@/lib/medication-color";
import { DateText, useLocale } from "./preferences-provider";
import { LifeImpactSummary } from "./life-impact-summary";
import { Icon } from "./icon";
import styles from "./personal-charts.module.css";

type Props = { medications: Medication[]; observations: PersonalObservation[]; checkins: CycleCheckin[]; periods: CyclePeriod[]; initialMedication: string; today: string };
type Layer = "symptoms" | "wellbeing" | "sleep" | "medications" | "bleeding";
type Metric = "symptoms" | "wellbeing" | "sleep";

export function PersonalCharts({ medications, observations, checkins, periods, initialMedication, today }: Props) {
  const locale = useLocale(), en = locale === "en", uid = useId();
  const say = (pl: string, english: string) => en ? english : pl;
  const format = (date: string, full = false) => new Intl.DateTimeFormat(en ? "en-GB" : "pl-PL", { day: "numeric", month: full ? "long" : "short", ...(full ? { year: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const [length, setLength] = useState(30), [to, setTo] = useState(today);
  const [medicationId, setMedicationId] = useState(initialMedication), [symptomKey, setSymptomKey] = useState("");
  const [metric, setMetric] = useState<Metric>("symptoms");
  const [layers, setLayers] = useState<Layer[]>(["medications", "bleeding"]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const plotContainer = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(800);
  useEffect(() => {
    const element = plotContainer.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setPlotWidth(Math.max(280, Math.round(width))); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const WIDTH = plotWidth, LEFT = plotWidth < 500 ? 36 : 48, RIGHT = 24, PLOT = WIDTH - LEFT - RIGHT;
  const window = chartWindow(to, length, today)!;
  const days = useMemo(() => buildChartDays(window.from, window.to, observations, medications, checkins, periods, medicationId, symptomKey), [window.from, window.to, observations, medications, checkins, periods, medicationId, symptomKey]);
  const [selected, setSelected] = useState(() => days.filter(item => item.symptoms.length || item.checkin || item.medicationStarts.length || item.bleeding.length).at(-1)?.date ?? today);
  const day = days.find(item => item.date === selected) ?? days.at(-1)!;
  const selectedIndex = days.findIndex(item => item.date === day.date);
  const categories = [...new Map(observations.filter(item => item.date <= today && (!medicationId || item.medicationId === medicationId)).map(item => {
    const key = observationKey(item);
    return [key, key.startsWith("group:") ? groupLabel(key.slice(6), locale) ?? item.symptom : item.symptom];
  })).entries()];
  const definitions: { id: Layer; label: string; color: string; height: number }[] = [
    { id: "symptoms", label: say("Objawy", "Symptoms"), color: "#583C5E", height: 244 },
    { id: "wellbeing", label: say("Nastrój i energia", "Mood & energy"), color: "#60736F", height: 244 },
    { id: "sleep", label: say("Sen", "Sleep"), color: "#8B7089", height: 244 },
    { id: "medications", label: say("Początki leków", "Medication starts"), color: "#A38463", height: 62 },
    { id: "bleeding", label: say("Krwawienie", "Bleeding"), color: "#A8757B", height: 62 },
  ];
  let offset = 24;
  const lanes = definitions.filter(layer => layer.id === metric || layers.includes(layer.id)).map(layer => { const top = offset; offset += layer.height; return { ...layer, top }; });
  const height = offset + 42, cell = PLOT / days.length;
  const x = (index: number) => LEFT + cell * (index + .5);
  const scoreY = (top: number, value: number) => top + 22 + (5 - value) * 46;
  const dateStep = Math.max(1, Math.ceil(days.length / (plotWidth < 500 ? 4 : 7)));
  const symptomDays = days.filter(item => item.symptoms.length).length, checkinDays = days.filter(item => item.checkin).length;
  const sleepDays = days.filter(item => item.checkin?.sleep_hours !== null && item.checkin?.sleep_hours !== undefined && Number.isFinite(item.checkin.sleep_hours) && item.checkin.sleep_hours >= 0 && item.checkin.sleep_hours <= 24).length;
  const recordedDays = days.filter(item => item.symptoms.length || item.checkin);
  const focus = definitions.find(layer => layer.id === metric)!;
  const focusDays = metric === "symptoms" ? symptomDays : metric === "sleep" ? sleepDays : days.filter(item => recordedRating(item.checkin?.mood) || recordedRating(item.checkin?.energy)).length;
  function setWindow(end: string, size = length) {
    const next = chartWindow(end, size, today);
    if (!next) return;
    setTo(end); setLength(size);
    setSelected(current => current < next.from || current > next.to ? end : current);
  }
  function keySelect(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(days[index].date); }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); const next = Math.max(0, Math.min(days.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
      setSelected(days[next].date);
      event.currentTarget.parentElement?.querySelector<SVGGElement>(`[data-day-index="${next}"]`)?.focus();
    }
  }
  return <div className={styles.root}>
    <header className={styles.heading}><div><p className="eyebrow">{say("Twoje zapisy, w jednym miejscu", "Your records, in one place")}</p><h1>{say("Mapa", "A map of")} <em>{say("Twoich dni.", "your days.")}</em></h1><p>{say("Zobacz, kiedy pojawiały się obserwacje i co zapisałaś o swoim dniu. Dotknij daty, aby przyjrzeć się jej bliżej.", "See when observations occurred and what you recorded about your day. Select a date to take a closer look.")}</p></div><Link className="button-quiet" href={medicationId ? `/my-normal?med=${medicationId}` : "/my-normal"}><Icon name="wave" />{say("Moja norma", "My normal")}</Link></header>
    <section className={styles.controls} aria-label={say("Filtry wykresu", "Chart filters")}>
      <div className={styles.rangeRow}><div className={styles.rangeButtons} role="group" aria-label={say("Zakres dni", "Day range")}>{[7, 30, 90].map(size => <button type="button" aria-pressed={length === size} key={size} onClick={() => setWindow(to, size)}>{size} {say("dni", "days")}</button>)}</div><div className={styles.periodNavigation}><button type="button" onClick={() => setWindow(addPatternDays(to, -length))} aria-label={say("Poprzedni okres", "Previous interval")}><span aria-hidden="true">←</span></button><span><DateText value={window.from} /> — <DateText value={window.to} /></span><button type="button" disabled={to === today} onClick={() => setWindow(addPatternDays(to, length) > today ? today : addPatternDays(to, length))} aria-label={say("Kolejny okres", "Next interval")}><span aria-hidden="true">→</span></button></div><div className={styles.toolbarActions}><button type="button" className="text-button" onClick={() => setWindow(today)}>{say("Do dzisiaj", "Up to today")}</button><button type="button" className={styles.filterButton} aria-expanded={filtersOpen} aria-controls={`${uid}-filters`} onClick={() => setFiltersOpen(value => !value)}><Icon name="plus" />{say("Filtry", "Filters")}</button></div></div>
      <div className={styles.filterSummary}><span><Icon name="pill" />{medications.find(med => med.id === medicationId)?.name ?? say("Wszystkie moje leki", "All my medications")}</span>{symptomKey && <span>{categories.find(([key]) => key === symptomKey)?.[1]}</span>}<span>{say("Tylko Twoje zapisane obserwacje", "Only your recorded observations")}</span></div><div id={`${uid}-filters`} hidden={!filtersOpen} className={styles.filters}><label>{say("Lek w obserwacjach", "Medication in observations")}<select className="input" value={medicationId} onChange={event => { setMedicationId(event.target.value); setSymptomKey(""); }}><option value="">{say("Wszystkie moje leki", "All my medications")}</option>{medications.map(med => <option key={med.id} value={med.id}>{med.name} · {med.dose}</option>)}</select></label><label>{say("Opis objawu", "Symptom description")}<select className="input" value={symptomKey} onChange={event => setSymptomKey(event.target.value)}><option value="">{say("Wszystkie opisy", "All descriptions")}</option>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>{say("Ostatni dzień zakresu", "Last day in range")}<input className="input" type="date" value={to} max={today} onInput={event => setWindow(event.currentTarget.value)} onChange={event => setWindow(event.target.value)} /></label></div>
    </section>
    <div className={styles.layout}><section className={styles.chartCard} aria-labelledby={`${uid}-chart-title`}>
      <div className={styles.chartHeading}><div><p className="eyebrow">{say("Obserwacje w czasie", "Observations over time")}</p><h2 id={`${uid}-chart-title`}>{say("Twój rytm.", "Your rhythm.")} <em>{say("Twoje zapisy.", "Your records.")}</em></h2></div><span className={styles.chartBadge}><span />{say("Z Twojego dziennika", "From your journal")}</span></div>
      <div className={styles.metricTabs} role="group" aria-label={say("Wybierz wykres", "Choose a chart")}>
        {definitions.filter(layer => ["symptoms", "wellbeing", "sleep"].includes(layer.id)).map(layer => <button type="button" key={layer.id} aria-pressed={metric === layer.id} onClick={() => setMetric(layer.id as Metric)}><Icon name={layer.id === "symptoms" ? "wave" : layer.id === "sleep" ? "moon" : "smile"} /><span>{layer.label}<small>{layer.id === "sleep" ? say("Godziny snu", "Hours of sleep") : layer.id === "symptoms" ? say("Twoje nasilenie · 1–5", "Your severity · 1–5") : say("Twoja ocena · 1–5", "Your rating · 1–5")}</small></span></button>)}
      </div>
      <div className={styles.plotHeading}><div><span className={styles.plotColor} style={{background:focus.color}} /><h3>{focus.label}</h3><span>{metric === "sleep" ? say("godziny", "hours") : say("skala 1–5", "scale 1–5")}</span></div><span>{focusDays} {say(focusDays === 1 ? "dzień z danymi" : "dni z danymi", focusDays === 1 ? "day with data" : "days with data")}</span></div>
      <div className={styles.chartScroll} ref={plotContainer}>
        <svg key={metric} className={styles.plot} viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={say("Interaktywny wykres osobistych zapisów", "Interactive chart of personal records")} aria-describedby={`${uid}-chart-help`}>
          <defs><linearGradient id={`${uid}-selection`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#583C5E" stopOpacity=".09"/><stop offset="100%" stopColor="#583C5E" stopOpacity=".02"/></linearGradient></defs>
          <rect x={LEFT + cell * selectedIndex} y={8} width={cell} height={offset - 4} rx={Math.min(cell / 2, 10)} fill={`url(#${uid}-selection)`} aria-hidden="true" />
          {lanes.map(lane => <g key={lane.id}>
            {lane.id !== metric && <><line x1={LEFT} x2={WIDTH - RIGHT} y1={lane.top - 8} y2={lane.top - 8} className={styles.contextDivider} /><text x={LEFT} y={lane.top + 7} className={styles.laneLabel}>{lane.label}</text></>}
            {(lane.id === "symptoms" || lane.id === "wellbeing") && [1,2,3,4,5].map(score => <g key={score} aria-hidden="true"><line x1={LEFT} x2={WIDTH - RIGHT} y1={scoreY(lane.top,score)} y2={scoreY(lane.top,score)} className={styles.grid}/><text x={LEFT - 15} y={scoreY(lane.top,score)+4} textAnchor="end" className={styles.tick}>{score}</text></g>)}
            {lane.id === "sleep" && [0,6,12,18,24].map(hours => <g key={hours} aria-hidden="true"><line x1={LEFT} x2={WIDTH - RIGHT} y1={lane.top+22+(24-hours)*7.67} y2={lane.top+22+(24-hours)*7.67} className={styles.grid}/><text x={LEFT-12} y={lane.top+26+(24-hours)*7.67} textAnchor="end" className={styles.tick}>{hours}</text></g>)}
            {days.map((item,index) => <g key={item.date} aria-hidden="true" className={styles.marks}>
              {lane.id === "symptoms" && item.symptoms.filter(symptom=>recordedRating(symptom.severity)).map((symptom,n,list)=>{
                const cx=x(index)+Math.min(cell*.3,9)*(list.length===1?0:(n/(list.length-1)*2-1)),cy=scoreY(lane.top,symptom.severity),chosen=index===selectedIndex;
                return <g key={symptom.id}><line x1={cx} x2={cx} y1={cy+9} y2={scoreY(lane.top,1)} stroke={lane.color} strokeOpacity=".14" strokeWidth="2"/>{chosen&&<circle cx={cx} cy={cy} r={15} fill={lane.color} opacity=".09"/>}<circle cx={cx} cy={cy} r={chosen?7:5.5} fill={lane.color} stroke="var(--card)" strokeWidth="2.5"/>{chosen&&list.length===1&&<text x={Math.max(LEFT+25,Math.min(WIDTH-RIGHT-25,cx))} y={cy-23} textAnchor="middle" className={styles.valueLabel}>{symptom.severity}/5</text>}</g>;
              })}
              {lane.id === "wellbeing" && recordedRating(item.checkin?.mood) && <><circle cx={x(index)-5} cy={scoreY(lane.top,item.checkin!.mood!)} r={index===selectedIndex?13:9} fill="#60736F" opacity=".12"/><circle cx={x(index)-5} cy={scoreY(lane.top,item.checkin!.mood!)} r={6} fill="#60736F" stroke="var(--card)" strokeWidth="2"/></>}
              {lane.id === "wellbeing" && recordedRating(item.checkin?.energy) && <path d={`M${x(index)+6} ${scoreY(lane.top,item.checkin!.energy!)-6}l6 6-6 6-6-6Z`} fill="#A38463" stroke="var(--card)" strokeWidth="2"/>}
              {lane.id === "sleep" && item.checkin?.sleep_hours !== null && item.checkin?.sleep_hours !== undefined && Number.isFinite(item.checkin.sleep_hours) && item.checkin.sleep_hours>=0 && item.checkin.sleep_hours<=24 && <><line x1={x(index)} x2={x(index)} y1={lane.top+22+(24-item.checkin.sleep_hours)*7.67} y2={lane.top+206} stroke={lane.color} strokeOpacity=".18" strokeWidth={Math.min(cell*.4,8)}/><circle cx={x(index)} cy={lane.top+22+(24-item.checkin.sleep_hours)*7.67} r={7} fill={lane.color} stroke="var(--card)" strokeWidth="2"/>{index===selectedIndex&&<text x={Math.max(LEFT+25,Math.min(WIDTH-RIGHT-25,x(index)))} y={lane.top+22+(24-item.checkin.sleep_hours)*7.67-18} textAnchor="middle" className={styles.valueLabel}>{item.checkin.sleep_hours} h</text>}</>}
              {lane.id === "medications" && item.medicationStarts.map((med,n)=><rect key={med.id} x={x(index)-6} y={lane.top+20+(n%3)*7} width={12} height={9} rx={4.5} fill={medicationColor(med.name).hex} stroke="var(--foreground)" strokeWidth=".5"/>)}
              {lane.id === "bleeding" && item.bleeding.length>0&&<rect x={LEFT+index*cell+1} y={lane.top+24} width={Math.max(2,cell-2)} height={9} rx={4} fill={lane.color} opacity=".65"/>}
            </g>)}
          </g>)}
          {days.filter((_,index)=>(index%dateStep===0&&days.length-1-index>=dateStep*.7)||index===days.length-1).map(item=><text key={item.date} x={x(days.indexOf(item))} y={offset+20} textAnchor="middle" className={styles.tick}>{format(item.date)}</text>)}
          {days.map((item,index)=><g role="button" tabIndex={index===selectedIndex?0:-1} data-day-index={index} key={item.date} aria-pressed={index===selectedIndex} aria-label={`${format(item.date,true)}: ${say("wpisy objawów","symptom entries")} ${item.symptoms.length}, ${item.checkin?say("samopoczucie zapisane","check-in recorded"):say("bez zapisu samopoczucia","no check-in")}`} onClick={()=>setSelected(item.date)} onKeyDown={event=>keySelect(event,index)} className={styles.dayHit}><title>{`${format(item.date,true)} · ${say("Kliknij, aby zobaczyć zapisy","Select to view records")}`}</title><rect x={LEFT+cell*index} y={8} width={cell} height={offset-4} fill="transparent"/></g>)}
        </svg>
      </div>
      {metric === "wellbeing" && <div className={styles.legend}><span><i className={styles.moodDot}/>{say("Nastrój","Mood")}</span><span><i className={styles.energyDiamond}/>{say("Energia","Energy")}</span></div>}
      <div className={styles.contextControls}><span>{say("Na osi czasu", "On the timeline")}</span><div className={styles.toggles} role="group" aria-label={say("Widoczne dane kontekstowe", "Visible context data")}>{definitions.filter(layer=>["medications","bleeding"].includes(layer.id)).map(layer=><button type="button" key={layer.id} aria-pressed={layers.includes(layer.id)} onClick={()=>setLayers(current=>current.includes(layer.id)?current.filter(id=>id!==layer.id):[...current,layer.id])}><span style={{background:layer.color}}/>{layer.label}<Icon name="check"/></button>)}</div></div>
      <div className={styles.recordedNavigation}><span>{say("Dni z obserwacjami", "Days with observations")}</span>{recordedDays.length?<div>{recordedDays.map(item=><button type="button" key={item.date} aria-pressed={day.date===item.date} onClick={()=>setSelected(item.date)}>{format(item.date)}<Icon name="arrow"/></button>)}</div>:<p>{say("Jeszcze bez wpisów w tym zakresie", "No entries in this interval yet")}</p>}</div>
      <div className={styles.coverage}><span><strong>{symptomDays}</strong> {say(symptomDays === 1 ? "dzień z wpisem objawu" : "dni z wpisem objawu", symptomDays === 1 ? "day with symptom entries" : "days with symptom entries")}</span><span><strong>{checkinDays}</strong> {say(checkinDays === 1 ? "dzień z zapisem samopoczucia" : "dni z zapisem samopoczucia", checkinDays === 1 ? "day with a check-in" : "days with a check-in")}</span></div>
      {!symptomDays && !checkinDays && <p className="notice">{say("W tym zakresie nie ma wpisów objawów ani zapisów samopoczucia. Wybierz wcześniejszy okres lub dodaj własny zapis.", "There are no symptom entries or check-ins in this interval. Choose an earlier interval or add your own entry.")}</p>}
      <p id={`${uid}-chart-help`} className={styles.caption}>{say("Puste miejsca oznaczają brak wpisu, nie brak objawu. Samopoczucie dotyczy całego dnia, niezależnie od filtra leku. Na wykresie użyj kliknięcia lub klawiszy ← →; szczegóły wybranego dnia znajdziesz w panelu. Grupy opisów nie są diagnozami.", "Empty space means no entry, not no symptom. Check-ins describe the whole day, independently of the medication filter. Click or use the ← → keys on the chart; the selected day’s details are available in the panel. Description groups are not diagnoses.")}</p>
    </section>
    <aside className={styles.detail} aria-labelledby={`${uid}-detail-title`}>
      <div className={styles.detailHeader}><div className={styles.detailTop}><p className="eyebrow">{say("Wybrany dzień", "Selected day")}</p><Icon name="calendar" /></div><h2 id={`${uid}-detail-title`}><DateText value={day.date} /></h2><p>{say("Małe szczegóły tworzą Twoją historię.", "Small details tell your story.")}</p></div>
      <div className={styles.dayNavigation}><button type="button" className="button-quiet" disabled={selectedIndex === 0} onClick={() => setSelected(days[selectedIndex - 1].date)} aria-label={say("Poprzedni dzień", "Previous day")}>←</button><label className={styles.dateLabel}>{say("Wybrany dzień", "Selected day")}<input className="input" type="date" value={day.date} min={window.from} max={window.to} onInput={event => { if (days.some(item => item.date === event.currentTarget.value)) setSelected(event.currentTarget.value); }} onChange={event => { if (days.some(item => item.date === event.target.value)) setSelected(event.target.value); }} /></label><button type="button" className="button-quiet" disabled={selectedIndex === days.length - 1} onClick={() => setSelected(days[selectedIndex + 1].date)} aria-label={say("Kolejny dzień", "Next day")}>→</button></div>
      <div className={styles.dayDetails} aria-live="polite" aria-atomic="true">
        <section><h3>{say("Twoje objawy", "Your symptoms")}</h3>{day.symptoms.length ? day.symptoms.map(item => <article key={item.id} className={styles.symptom}><Link href={`/context?event=${item.id}`}>{item.symptom} ↗</Link><p>{say("Nasilenie", "Severity")} {item.severity}/5 · {item.medicationName}</p>{item.note && <p className={styles.ownNote}>{item.note}</p>}<LifeImpactSummary impacts={item.lifeImpacts} note={item.impactNote} /></article>) : <p className={styles.missing}>{say("Bez wpisu objawu dla wybranych filtrów.", "No symptom entry for the selected filters.")}</p>}</section>
        <section><h3>{say("Samopoczucie i dzień", "Wellbeing and your day")}</h3>{day.checkin ? <><div className={styles.checkinValues}>{[[say("Nastrój", "Mood"), day.checkin.mood !== null ? `${day.checkin.mood}/5` : "—"], [say("Energia", "Energy"), day.checkin.energy !== null ? `${day.checkin.energy}/5` : "—"], [say("Sen", "Sleep"), day.checkin.sleep_hours !== null ? `${day.checkin.sleep_hours} h` : "—"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className={styles.contextTags}>{day.checkin.hydration && <span>{say("Woda", "Water")}: {({ less: say("mniej niż zwykle", "less than usual"), usual: say("jak zwykle", "as usual"), more: say("więcej niż zwykle", "more than usual"), unsure: say("nie jestem pewna", "unsure") })[day.checkin.hydration]}</span>}{day.checkin.meals_regular && <span>{say("Regularne posiłki", "Regular meals")}: {({ yes: say("tak", "yes"), no: say("nie", "no"), unsure: say("nie jestem pewna", "unsure") })[day.checkin.meals_regular]}</span>}</div>{day.checkin.note && <p className={styles.ownNote}>{day.checkin.note}</p>}</> : <p className={styles.missing}>{say("Bez zapisu samopoczucia dla tego dnia.", "No check-in for this day.")}</p>}</section>
        <section><h3>{say("Początek leku", "Medication start")}</h3>{day.medicationStarts.length ? day.medicationStarts.map(med => <p key={med.id} className={styles.medication}><span style={{ background: medicationColor(med.name).hex }} />{med.name} · {med.dose}</p>) : <p className={styles.missing}>{say("Bez zapisanego rozpoczęcia w tym dniu.", "No recorded start on this day.")}</p>}</section>
        <section><h3>{say("Zapis krwawienia", "Bleeding record")}</h3>{day.bleeding.length ? day.bleeding.map(period => <p key={period.id} className={styles.missing}>{say("Początek", "Start")}: <DateText value={period.started_on} /> · {period.ended_on ? <>{say("koniec", "end")}: <DateText value={period.ended_on} /></> : say("koniec nie został zapisany", "end not recorded")}{period.note && <span className={styles.ownNote}>{period.note}</span>}</p>) : <p className={styles.missing}>{say("Bez zapisu obejmującego ten dzień.", "No record covering this day.")}</p>}</section>
      </div>
      <Link className="text-button" href={medicationId ? `/?med=${medicationId}` : "/"}>{say("Zapisz nową obserwację", "Record a new observation")} <Icon name="arrow" /></Link>
    </aside></div>
    <footer className={styles.footer}><Icon name="info" /><div><p>{say("Wspólna oś czasu pokazuje daty, nie przyczynę. Wykres nie określa ryzyka ani wpływu leku i nie mierzy faz hormonalnych.", "A shared timeline shows dates, not causes. The chart does not determine risk or medication effects, and does not measure hormonal phases.")}</p><small>{say("Źródło: Twoje potwierdzone zapisy. Dostępne są maksymalnie 90 ostatnich zapisów samopoczucia i 24 ostatnie zapisy krwawienia. Przedziały snu i krwawienia pochodzą wyłącznie z wpisanych danych.", "Source: your confirmed records. Up to 90 recent check-ins and 24 recent bleeding records are available. Sleep values and bleeding intervals come only from recorded data.")}</small></div></footer>
  </div>;
}
