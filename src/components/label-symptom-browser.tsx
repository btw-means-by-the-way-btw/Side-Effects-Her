"use client";
import {useState} from "react";
import type {DrugLabelRecord} from "@/lib/evidence/types";
import type {MedicationSymptomSource,TimelineItem} from "@/lib/models";
import {SYMPTOM_GROUPS,matchSymptomGroup} from "@/lib/symptom-groups";
import {groupLabelQuotes,type LabelQuote} from "@/lib/label-quotes";
import {DateText,useLocale,useT} from "./preferences-provider";
import {Icon} from "./icon";
import {LabelQuoteContext} from "./label-quote-context";

function QuoteDisclosure({quote,labels,medicationId}:{quote:LabelQuote;labels:DrugLabelRecord[];medicationId:string}) {
  const [open,setOpen]=useState(false),en=useLocale()==="en",t=useT();
  return <details className="matched-source-context" onToggle={event=>{if(event.target===event.currentTarget)setOpen(event.currentTarget.open);}}>
    <summary>{t("Otwórz pełny kontekst")}</summary>
    {open&&<div className="quote-contexts">{quote.sources.map(source=><section key={source.label_id+source.source_url+(source.label_effective_time??"")} className="quote-label-context">
      <h4>{en?"FDA label":"Etykieta FDA"} · {source.label_id.slice(0,8)}</h4>
      {source.label_effective_time&&<small>{en?"Label date: ":"Data etykiety: "}<DateText value={source.label_effective_time}/></small>}
      <LabelQuoteContext medicationId={medicationId} label={labels.find(item=>item.id===source.label_id)} phrase={quote.phrase}/>
    </section>)}</div>}
  </details>;
}

export function LabelSymptomBrowser({sources,labels,timeline,available,medicationId}:{sources:MedicationSymptomSource[];labels:DrugLabelRecord[];timeline:TimelineItem[];available:boolean;medicationId:string}) {
  const [query,setQuery]=useState(""),[chosen,setChosen]=useState<string|null>(null),en=useLocale()==="en",t=useT();
  const personal=new Set(timeline.filter(item=>item.kind==="symptom").map(item=>item.kind==="symptom"?item.groupId:null));
  const groups=SYMPTOM_GROUPS.map(group=>({...group,sources:sources.filter(s=>s.symptom_group_id===group.id),personal:personal.has(group.id)})).filter(group=>group.sources.length);
  const normalized=query.trim().toLowerCase(),match=matchSymptomGroup(query);
  const visible=groups.filter(group=>(!chosen||group.id===chosen)&&(!normalized||group.id===match||group.labelPl.toLowerCase().includes(normalized)||group.label.toLowerCase().includes(normalized)||group.sources.some(s=>s.exact_phrase.toLowerCase().includes(normalized)))).sort((a,b)=>Number(b.personal)-Number(a.personal));
  const sourceUrls=[...new Set(sources.map(source=>source.source_url))];
  function labelCount(count:number) {
    if(en)return count===1?"1 source label":count+" source labels";
    if(count===1)return "1 etykieta źródłowa";
    return count+(count%10>=2&&count%10<=4&&!(count%100>=12&&count%100<=14)?" etykiety źródłowe":" etykiet źródłowych");
  }
  return <section id="symptom-labels" className="symptom-browser" aria-labelledby="symptom-browser-title">
    <div className="section-heading"><div><p className="eyebrow">{en?"Start with what you noticed":"Zacznij od tego, co zauważyłaś"}</p><h2 id="symptom-browser-title">{t("Objawy w etykiecie")}</h2></div><span className="source-pill">FDA · {en?"source quotes":"cytaty źródłowe"}</span></div>
    <p className="section-copy">{en?"Search your symptom, for example ‘headache’. We show exact phrases from the adverse-reactions section, grouped for lookup. No causal conclusion or risk estimate.":"Wpisz swój objaw, np. „ból głowy”. Pokazujemy dokładne frazy z sekcji działań niepożądanych, pogrupowane dla wyszukiwania. Bez wniosku o przyczynie i bez oceny ryzyka."}</p>
    <label className="label" htmlFor="label-symptom-query">{t("Szukaj objawu")}</label>
    <div className="symptom-search"><Icon name="wave"/><input className="input" id="label-symptom-query" value={query} onChange={event=>{setQuery(event.target.value);setChosen(null);}} placeholder={en?"Headache, nausea, fatigue…":"Ból głowy, nudności, zmęczenie…"}/></div>
    {groups.length>0&&<div className="symptom-group-chips"><button type="button" aria-pressed={!chosen} onClick={()=>{setChosen(null);setQuery("");}}>{en?"All descriptions":"Wszystkie opisy"}</button>{groups.map(group=><button type="button" key={group.id} aria-pressed={chosen===group.id} onClick={()=>{setChosen(group.id);setQuery("");}}>{group.personal&&<span aria-hidden="true">● </span>}{en?group.label:group.labelPl}</button>)}</div>}
    <div className="symptom-source-grid">{visible.map(group=><article key={group.id} className={"symptom-source-card "+(group.personal?"personal-match":"")}>
      <span className="icon-bubble"><Icon name="wave"/></span>
      <div><p className="eyebrow">{group.personal?t("Dopasowanie Twojego opisu"):t("Cytat z etykiety")}</p><h3>{en?group.label:group.labelPl}</h3>
        {group.personal&&<p className="match-caption">{en?"You recorded a description in this category. This is a text match, not a medical assessment.":"Masz zapis w tej kategorii. To dopasowanie opisu, nie ocena medyczna."}</p>}
        <ul>{groupLabelQuotes(group.sources).map(quote=><li key={quote.phrase}>
          <small className="quote-original-caption">{en?"Original quote · EN":"Cytat oryginalny · EN"}</small><q className="exact-phrase" lang="en">{quote.phrase}</q>
          <small className="quote-provenance">{labelCount(new Set(quote.sources.map(source=>source.label_id)).size)}</small>
          <QuoteDisclosure quote={quote} labels={labels} medicationId={medicationId}/>
        </li>)}</ul>
      </div>
    </article>)}</div>
    {!visible.length&&<p className="notice-attention">{available?(en?"No verified matching text found in this partial index.":"Brak zweryfikowanego dopasowania w tym częściowym indeksie."):(en?"The classification index is unavailable. Use the original source below.":"Indeks klasyfikacji jest niedostępny. Skorzystaj z oryginalnego źródła poniżej.")} {t("To nie wyklucza działania leku.")}</p>}
    {sourceUrls.length>0&&<footer className="symptom-sources-footer" aria-label={en?"Sources for symptom quotes":"Źródła cytatów o objawach"}>
      <span className="icon-bubble"><Icon name="book"/></span>
      <div><p className="eyebrow">{en?"Sources for this section":"Źródła tej sekcji"}</p>
        <p>{en?"Identical quotes are shown once. Expand the context to see each source label separately.":"Identyczne cytaty pokazujemy raz. Rozwiń kontekst, aby zobaczyć każdą etykietę źródłową osobno."}</p>
        <div className="symptom-source-links">{sourceUrls.map((url,index)=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-link">{en?"Open FDA labels":"Otwórz etykiety FDA"}{sourceUrls.length>1?" · "+(index+1):""} ↗</a>)}</div>
      </div>
    </footer>}
    <p className="section-foot">{en?"Partial index: up to two labels and 16,000 characters per adverse-reactions section. Quotes remain in the source language. A mention may depend on a particular therapy or study population; check the full context and product.":"Indeks częściowy: do dwóch etykiet i 16 000 znaków z sekcji działań niepożądanych każdej z nich. Krótkie cytaty pozostają w języku źródła; pełny kontekst ma pomocnicze tłumaczenie na polski i dostępny oryginał. Wzmianka może dotyczyć określonej terapii lub populacji badania; sprawdź pełny kontekst i produkt."}</p>
  </section>;
}
