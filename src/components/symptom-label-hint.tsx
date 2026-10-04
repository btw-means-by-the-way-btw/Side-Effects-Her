"use client";
import Link from "next/link";
import {matchSymptomGroup,groupLabel} from "@/lib/symptom-groups";
import type {MedicationSymptomSource} from "@/lib/models";
import {useLocale} from "./preferences-provider";
import {Icon} from "./icon";
export function SymptomLabelHint({symptom,sources,medicationId}:{symptom:string;sources:MedicationSymptomSource[];medicationId:string}) {
 const locale=useLocale(),en=locale==="en",group=matchSymptomGroup(symptom),matches=sources.filter(source=>source.symptom_group_id===group);
 if(!symptom.trim()||!group)return null;
 return <aside className={`symptom-match ${matches.length?"found":""}`} role="status"><Icon name="book"/><div><p className="eyebrow">{en?"Text lookup, not a cause":"Dopasowanie tekstu, nie przyczyna"}</p><h3>{matches.length?(en?`${groupLabel(group,"en")} is mentioned in the checked label text`:`${groupLabel(group,"pl")} — wzmianka w sprawdzonym tekście etykiety`):(en?"No verified matching text in the available index":"Brak zweryfikowanego dopasowania w dostępnym indeksie")}</h3>{matches.length>0&&<p>{en?"Exact source phrase":"Dokładna fraza źródłowa"}: <q>{matches[0].exact_phrase}</q></p>}<p>{matches.length?(en?"A matching phrase does not establish that your product caused your symptom. Open the full source context and check the formulation.":"Wspólny opis nie ustala, że Twój lek spowodował objaw. Sprawdź pełny kontekst i postać produktu."):(en?"The index is partial or unavailable. This does not rule out a medication effect.":"Indeks jest częściowy lub niedostępny. Brak dopasowania nie wyklucza działania leku.")}</p><Link className="text-link" href={`/what-we-know?med=${medicationId}#symptom-labels`}>{en?"View symptom lookup →":"Zobacz wyszukiwarkę objawów →"}</Link></div></aside>;
}
