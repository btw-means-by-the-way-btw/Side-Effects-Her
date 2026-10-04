"use client";

import type { DrugEventData, EvidenceLookup } from "@/lib/evidence/types";
import { InformationCard } from "./information-card";
import { DateText, useLocale } from "./preferences-provider";
import styles from "./women-reporting.module.css";
import { reportedReactionLabel } from "@/lib/reported-reaction-label";

export function WomenReporting({result}:{result:EvidenceLookup<DrugEventData>}) {
  const en = useLocale() === "en";
  const copy = (pl:string,english:string) => en ? english : pl;
  const data = result.status === "ok" ? result.data : null;
  const counts = data?.sexCountStatus === "available" ? data.reportedSexCounts ?? [] : [];
  const femaleCount = counts.find(row => row.code === "2")?.reportCount;
  const reactions = data?.femaleReactions;
  const reactionRows = reactions?.counts?.map(row => ({ ...row, ...reportedReactionLabel(row.term, en ? "en" : "pl") })) ?? [];
  const hasFemaleReports = (femaleCount ?? 0) > 0 || Boolean(reactions?.counts?.some(row => row.reportCount > 0));
  const unavailable = result.status === "unavailable" || result.status === "invalid_request" || data?.sexCountStatus === "unavailable";
  const availability = counts.length ? copy("Dostępne","Available") : unavailable ? copy("Chwilowo niedostępne","Currently unavailable") : copy("Nie znaleziono","Not found");
  const format = (value:number) => new Intl.NumberFormat(en ? "en-GB" : "pl-PL").format(value);
  const rows = [
    {code:"2",label:copy("Raporty dotyczące pacjentek","Reports involving female patients"),color:"#583C5E"},
    {code:"1",label:copy("Raporty dotyczące pacjentów płci męskiej","Reports involving male patients"),color:"#60736F"},
    ...(counts.some(row => row.code === "0") ? [{code:"0",label:copy("Raporty z nieznaną płcią pacjenta","Reports with unknown patient sex"),color:"#B7B1AC"}] : []),
    ...counts.filter(row => !["0","1","2"].includes(row.code)).map(row => ({code:row.code,label:copy(`Inny kod płci w źródle: ${row.code}`,`Other source sex code: ${row.code}`),color:"#B7B1AC"})),
  ];
  const canTell = [
    counts.length ? copy("Dla tego wyszukiwania są dostępne liczby raportów według płci.","Sex-stratified report counts are available for this lookup.") : copy("Dla tego wyszukiwania nie uzyskano podziału według płci.","No sex-stratified counts were obtained for this lookup."),
    hasFemaleReports ? copy("W dopasowanych raportach są zapisane pacjentki.","Female patients appear in the matching reports.") : copy("Dostępne dane nie potwierdzają obecności raportów dotyczących pacjentek.","Available data do not confirm the presence of female-patient reports."),
    reactions?.status === "available" ? copy("Możemy pokazać reakcje wymieniane w raportach dotyczących pacjentek.","Reactions recorded in female-patient reports can be explored.") : copy("Reakcje według płci można sprawdzić w źródle; lista tutaj jest niedostępna.","Reactions by sex can be explored at the source; the list here is unavailable."),
  ];
  const cannotTell = [
    copy("Czy kobiety mają większe ryzyko kliniczne.","Whether women have a higher clinical risk."),
    copy("Jak często reakcja występuje wśród osób stosujących lek.","How often a reaction occurs among people taking the medication."),
    copy("Czy lek spowodował opisane zdarzenie.","Whether the medication caused the event."),
    copy("Czy liczby raportów dotyczących kobiet i mężczyzn są bezpośrednio porównywalne.","Whether female and male report counts are directly comparable."),
  ];
  return <InformationCard id="reports" tone="reports" number="03"
    eyebrow={copy("KONTEKST ZGŁOSZEŃ DOTYCZĄCYCH KOBIET","WOMEN-SPECIFIC REPORTING CONTEXT")}
    title={copy("Co wiemy o kobietach?","What do we know about women?")}
    description={copy(`Dane o spontanicznych zgłoszeniach wymieniających „${result.medicationName}”. Pokazujemy, jakie informacje o płci pacjentów są dostępne w źródle.`,`Spontaneous reports mentioning “${result.medicationName}”. Here is the patient-sex information available in the source.`)}>
    <div className={styles.summary}>
      <div className={styles.availability}><div><h3>{copy("Dane według płci pacjenta","Sex-stratified reporting data")}</h3><p>{copy("Płeć zapisana w raporcie, nie płeć osoby zgłaszającej.","Patient sex recorded in the report, not the reporter’s sex.")}</p></div><span className={`${styles.badge} ${counts.length ? styles.available : ""}`}>{availability}</span></div>
      {data ? <dl className={styles.stats}>{rows.map(row => {
        const count = counts.find(item => item.code === row.code)?.reportCount;
        return <div key={row.code}><dt><span className={styles.dot} style={{backgroundColor:row.color}} aria-hidden="true"/>{row.label}</dt><dd>{count === undefined ? <span className={styles.noValue}>{copy("Brak danych","Not available")}</span> : <>{format(count)} <small>{copy("raportów","reports")}</small></>}</dd></div>;
      })}</dl> : <p className={styles.empty}>{result.status === "not_found" ? copy("Nie znaleziono raportów dla tej nazwy leku. Brak raportów nie oznacza braku działania niepożądanego.","No matching reports were found for this medication name. Missing reports do not establish an absence of adverse effects.") : result.status === "invalid_request" ? copy("Nie można wyszukać tej nazwy leku. Sprawdź jej zapis.","This medication name cannot be queried. Check its spelling.") : copy("Nie udało się pobrać danych openFDA. Spróbuj ponownie później.","openFDA data could not be retrieved. Try again later.")}</p>}
      <p className={styles.caption}>{copy("To liczby spontanicznych zgłoszeń, nie częstość występowania, prawdopodobieństwo ani dowód przyczynowości.","These are spontaneous reporting counts, not incidence rates, probability or proof of causality.")}</p>
    </div>
    <p className={styles.explanation}>{copy("Liczby pokazują, ile raportów w zbiorze openFDA wymienia ten lek i zapisuje płeć pacjenta. Nie pozwalają stwierdzić, że kobiety częściej doświadczają danej reakcji: nie znamy liczby osób stosujących lek ani różnic w zgłaszaniu zdarzeń.","These counts show how many reports in the openFDA dataset mention this medication and record the patient’s sex. They cannot be used to conclude that women experience a reaction more often, because exposure levels and reporting behavior are unknown.")}</p>
    {data && <p className={styles.coverage}>{copy("Brakujące pola płci mogą nie pojawić się w wynikach. Liczby dotyczą raportów, a nie unikalnych pacjentów. Nie wyliczamy brakującej grupy z łącznej liczby zgłoszeń.","Missing sex fields may be absent from the results. Counts refer to reports, not unique patients. We do not infer a missing group from total reports.")}</p>}
    <div className={styles.reactions}>
      <div className={styles.reactionHeading}><div><p className="eyebrow text-evidence">{copy("BLIŻEJ OPISANYCH REAKCJI","A CLOSER LOOK AT REPORTED REACTIONS")}</p><h3>{copy("Najczęściej wymieniane reakcje w raportach dotyczących pacjentek","Most reported reactions among female reports")}</h3></div><span className={styles.sourceTag}>FDA</span></div>
      {reactions?.status === "available" && reactionRows.length ? <ol className={styles.reactionList}>{reactionRows.map((row,index) => <li key={row.term}><span className={styles.ordinal} aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span lang={row.translated ? "pl" : "en"}>{row.label}{!en && !row.translated && <small className={styles.untranslated}> · EN</small>}</span><strong>{format(row.reportCount)} <small>{copy("raportów","reports")}</small></strong></li>)}</ol> : <p className={styles.empty}>{reactions?.status === "missing" ? copy("Nie znaleziono reakcji dla tego wyszukiwania raportów dotyczących pacjentek.","No reaction counts were found for this female-patient report lookup.") : copy("Lista reakcji jest chwilowo niedostępna. Nie uzupełniamy jej przykładowymi wartościami.","Reaction counts are currently unavailable. No example values are substituted.")}</p>}
      <p className={styles.coverage}>{copy("Do czterech najczęściej wymienianych terminów w tym wyszukiwaniu. Jeden raport może zawierać wiele reakcji i leków; liczby nie sumują się do liczby pacjentek. Kolejność opisuje zgłoszenia, nie ryzyko ani ciężkość reakcji.","Up to four most reported terms in this lookup. One report may contain multiple reactions and medications; counts do not add up to a patient total. Order reflects reporting, not risk or severity.")}</p>
      {!en && reactions?.status === "available" && reactionRows.length > 0 && <details className={styles.originalTerms}><summary>Oryginalne nazwy FDA · EN</summary><p>Polskie nazwy są tłumaczeniem pomocniczym. Terminy bez tłumaczenia oznaczamy jako EN.</p><ul>{reactionRows.map(row => <li key={row.term}><span>{row.label}</span><span lang="en">{row.term}</span></li>)}</ul></details>}
      {reactions?.sourceUrl && <a href={reactions.sourceUrl} className={styles.sourceLink} target="_blank" rel="noopener noreferrer">{copy("Zapytanie o reakcje w raportach dotyczących pacjentek","Source query for reactions in female-patient reports")} ↗</a>}
    </div>
    <div className={styles.meaning}><section><h3>{copy("CO TE DANE MOGĄ POWIEDZIEĆ","WHAT THIS DATA CAN TELL US")}</h3><ul>{canTell.map(item => <li key={item}>{item}</li>)}</ul></section><section><h3>{copy("CZEGO TE DANE NIE MOGĄ POWIEDZIEĆ","WHAT THIS DATA CANNOT TELL US")}</h3><ul>{cannotTell.map(item => <li key={item}>{item}</li>)}</ul></section></div>
    <footer className={styles.footer}><span>openFDA Drug Event {data?.datasetLastUpdated && <> · {copy("aktualizacja zbioru:","dataset updated:")} <DateText value={data.datasetLastUpdated}/></>}</span><div>{result.sourceUrls[0] && <a href={result.sourceUrls[0]} target="_blank" rel="noopener noreferrer">{copy("Otwórz zapytanie źródłowe","Open source query")} ↗</a>}{result.sourceUrls[1] && <a href={result.sourceUrls[1]} target="_blank" rel="noopener noreferrer">{copy("Podział według płci w źródle","Source sex-count query")} ↗</a>}</div></footer>
  </InformationCard>;
}
