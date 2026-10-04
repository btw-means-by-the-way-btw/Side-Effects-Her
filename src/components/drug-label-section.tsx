"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {fallbackLabelHeading,polishLabelHeading,presentLabelTopics,type LabelSection,type LabelTopic} from "@/lib/label-presentation";
import {useLocale,useT} from "./preferences-provider";

type PolishTopic={heading:string|null;text:string};
const requests=new Map<string,Promise<PolishTopic[]>>();
function loadTranslation(key:string,medicationId:string,labelId:string,section:LabelSection,topicCount:number):Promise<PolishTopic[]> {
  const existing=requests.get(key);if(existing)return existing;
  const work=(async()=>{
    const response=await fetch("/api/evidence/label/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({medicationId,labelId,section}),signal:AbortSignal.timeout(180_000)});
    const data=await response.json();
    if(!response.ok||data.status!=="ok"||data.language!=="pl"||data.labelId!==labelId||data.section!==section||!Array.isArray(data.topics)||data.topics.length!==topicCount||data.topics.some((topic:PolishTopic)=>!topic||typeof topic.text!=="string"||!topic.text.trim()||(topic.heading!==null&&typeof topic.heading!=="string")))throw Error("translation_unavailable");
    return data.topics as PolishTopic[];
  })();
  requests.set(key,work);
  if(requests.size>128)requests.delete(requests.keys().next().value!);
  work.catch(()=>{if(requests.get(key)===work)requests.delete(key);});
  return work;
}

export function DrugLabelSection({title,paragraphs,highlighted=false,medicationId,labelId,section}:{title:string;paragraphs:string[];highlighted?:boolean;medicationId:string;labelId:string;section:LabelSection}) {
  const en=useLocale()==="en",t=useT(),element=useRef<HTMLElement>(null);
  const sourceKey=JSON.stringify(paragraphs);
  const topics=useMemo(()=>presentLabelTopics(paragraphs),[sourceKey]);
  const [translation,setTranslation]=useState<PolishTopic[]|null>(null),[status,setStatus]=useState<"idle"|"loading"|"ready"|"unavailable">("idle"),[attempt,setAttempt]=useState(0);
  const key=JSON.stringify([medicationId,labelId,section,sourceKey]);
  useEffect(()=>{
    let alive=true,started=false;setTranslation(null);setStatus("idle");
    if(en||!topics.length)return;
    function start(){if(started)return;started=true;setStatus("loading");
      loadTranslation(key,medicationId,labelId,section,topics.length).then(result=>{if(alive){setTranslation(result);setStatus("ready");}}).catch(()=>{if(alive)setStatus("unavailable");});
    }
    const target=element.current;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){start();observer.disconnect();}},{rootMargin:"160px"});
    if(target)observer.observe(target);
    return()=>{alive=false;observer.disconnect();};
  },[en,key,medicationId,labelId,section,topics.length,attempt]);
  if(!paragraphs.length)return null;
  const statusText=status==="unavailable"?"Polskie tłumaczenie jest chwilowo niedostępne. Możesz rozwinąć oryginał FDA.":"Przygotowuję polskie tłumaczenie…";
  function heading(topic:LabelTopic,index:number){
    if(en)return topic.heading?.replace(/^\d+\.?\s*/,"").trim()||fallbackLabelHeading(section,true);
    return polishLabelHeading(topic.heading)||translation?.[index]?.heading||fallbackLabelHeading(section);
  }
  return <section ref={element} className={"drug-label-section "+(highlighted?"highlighted":"")} data-translation-status={en?"original":status}>
    <div className="label-quick-heading"><p className="eyebrow">{en?"Source topics · FDA":"Tematy źródłowe · FDA"}</p><h4>{t(title)}</h4>
      <p>{highlighted?(en?"Highlighted safety text. Open the topics below and check the full product-specific warning.":"Wyróżnione informacje o bezpieczeństwie. Otwórz tematy poniżej i sprawdź pełne ostrzeżenie dotyczące produktu."):(en?"Choose a topic to read its source wording. These headings are navigation, not a summary of safety.":"Wybierz temat, by przeczytać jego treść. Nagłówki pomagają nawigować — nie zastępują informacji o bezpieczeństwie.")}</p>
      {!en&&topics.length>0&&<div className="label-translation-notice"><span className="translation-badge">PL · {status==="ready"?"tłumaczenie AI":"wersja pomocnicza"}</span><p>Automatyczne tłumaczenie może zawierać błędy. Nie jest polską ulotką ani wersją zatwierdzoną przez FDA. Oryginał pozostaje źródłem informacji.</p>{status==="unavailable"&&<button type="button" className="text-link" onClick={()=>setAttempt(value=>value+1)}>Spróbuj ponownie</button>}</div>}
    </div>
    <div className="label-topic-grid">{topics.map((topic,index)=>{
      const translated=translation?.[index];
      return <details key={index} className="label-topic">
        <summary><div><h5>{heading(topic,index)}</h5>
          <span className="source-excerpt" lang={en?"en":"pl"}>{en?topic.text.slice(0,140)+(topic.text.length>140?"…":""):translated?translated.text.slice(0,140)+(translated.text.length>140?"…":""):statusText}</span>
          <small>{en?"Source excerpt · expand full wording":translated?"Polskie tłumaczenie · rozwiń pełną treść":"Oryginał FDA dostępny po rozwinięciu"}</small>
        </div><span className="topic-expand" aria-hidden="true">+</span></summary>
        <div className="label-topic-body">
          {en?<p lang="en">{topic.text}</p>:<>
            {translated?<div className="label-polish-text" lang="pl"><span className="translation-badge">Tłumaczenie pomocnicze · AI</span><p>{translated.text}</p></div>:<p role="status" className="label-translation-status">{statusText}</p>}
            <details className="label-source-original"><summary>Oryginalny tekst FDA (EN)</summary><p lang="en">{topic.text}</p></details>
          </>}
          <p className="label-reading-note">{en?"Read with the other warnings, study populations and qualifiers in the complete source. This excerpt does not establish your individual risk.":"Czytaj razem z pozostałymi ostrzeżeniami, populacjami badań i zastrzeżeniami pełnego źródła. Ten fragment nie określa Twojego indywidualnego ryzyka."}</p>
        </div>
      </details>;
    })}</div>
    <details className="label-original"><summary>{en?"Complete original FDA section (EN)":"Pełny oryginalny tekst FDA (EN)"}</summary>{paragraphs.map((paragraph,index)=><p key={index} lang="en">{paragraph}</p>)}</details>
  </section>;
}
