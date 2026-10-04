import {TIME_PATTERN,validIsoDate} from "./daily.ts";
export interface PrescriptionCandidate {name:string;dose:string;startedOn:string;takeTime:string;remindTime:string;sourceLine:string;doseSource?:"strength"|"instructions"|"missing"}
const STRENGTH = /\b\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*(?:mcg|mg|µg|μg|ug|ml|IU|j\.m\.|g)(?:\s*\/\s*(?:ml|g))?(?![\p{L}\d])/iu;
const CLOCK = /\b(?:[01]\d|2[0-3]):[0-5]\d\b/;
const PRESCRIBED = /^(?:przepisano|prescribed)\s*[|:]\s*(.+)$/i;
const INSTRUCTIONS = /^(?:D\.?\s*S\.?|dawkowanie|dosage)\s*[,.:|]\s*(.+)$/i;
const BLOCK_END = /^(?:przepisano\s*[|:]|prescribed\s*[|:]|recepta\s+\d|odpłatność|payment|pacjent|patient|wystawiono|issued|wystawca|prescriber|PESEL|PWZ|tel\b)/i;
const PACKAGING = /^(?:No\.?\s|ilość\b|quantity\b|op\.\s|amp\b|fiol\b)|(?:\bpo\s+\d|ilość\s*:|amp\.-strz)/i;
function medicationName(value:string):string|null {
 const name=value.replace(/^\s*\d+[.)]\s*/,"").replace(/^(?:Rp\.?\s*:?|(?:nazwa\s+leku|lek|medication|drug)\s*:)\s*/i,"").trim();
 if(!/^[\p{L}][\p{L}\d .’'()-]{1,119}$/u.test(name)||/^(?:PESEL|pacjent(?:ka)?|patient|adres|address|data|date|dawkowanie|dosage|dawka|dose|moc|strength|godzina|time|przypomnienie|reminder|recepta|prescription|lekarz|doctor|realizacja|ilość|quantity)(?:\b|:)/i.test(name))return null;
 return name;
}
/** Conservative OCR draft: copies written names/strengths/times, never chooses a regimen.
 * Adjacent name/strength lines are supported; unrelated metadata breaks that association.
 */
export function parsePrescription(text:string):PrescriptionCandidate[] {
 const result:PrescriptionCandidate[]=[];
 const lines=text.slice(0,12000).split(/\r?\n/).map(line=>line.trim().replace(/[\t ]+/g," "));
 for(let index=0;index<lines.length;index++) {
  const line=lines[index];
  const prescribed=line.match(PRESCRIBED);
  if(prescribed){
   const body=prescribed[1];
   const inlineStrength=body.match(STRENGTH);
   const name=medicationName((inlineStrength ? body.slice(0,inlineStrength.index) : body).split(",")[0].trim());
   let end=index+1;
   while(end<lines.length&&!BLOCK_END.test(lines[end]))end++;
   if(name){
    const following=lines.slice(index+1,end);
    // Packaging volumes/counts are not medication strength or prescribed dosage.
    const strengthLine=following.find(value=>!PACKAGING.test(value)&&STRENGTH.test(value));
    const strength=inlineStrength?.[0]??strengthLine?.match(STRENGTH)?.[0]??"";
    const instructionLine=following.find(value=>INSTRUCTIONS.test(value));
    const instruction=instructionLine?.match(INSTRUCTIONS)?.[1].trim()??"";
    const dateLine=following.find(value=>/^(?:data rozpoczęcia|rozpoczęcie|start date)\s*[:|]/i.test(value));
    const start=dateLine?.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??"";
    const timeLine=following.find(value=>/^(?:godzina(?: dawki)?|dose time|time)\s*[:|]/i.test(value));
    const inlineTime=body.slice((inlineStrength?.index??body.length)+(inlineStrength?.[0].length??0)).match(CLOCK)?.[0]??"";
    const takeTime=timeLine?.match(CLOCK)?.[0]??instruction.match(CLOCK)?.[0]??inlineTime;
    const dose=strength||(instruction.length<=120?instruction:"");
    result.push({name,dose,startedOn:validIsoDate(start)?start:"",takeTime,remindTime:"",doseSource:strength?"strength":dose?"instructions":"missing",sourceLine:[line,strengthLine,instructionLine,dateLine,timeLine].filter((value):value is string=>Boolean(value)).join("\n").slice(0,500)});
   }
   index=end-1;
   if(result.length===5)break;
   continue;
  }
  const dose=line.match(STRENGTH);
  if(!dose||dose.index===undefined)continue;
  const prefix=line.slice(0,dose.index).trim();
  const standaloneStrength=/^(?:(?:dawka|dose|moc|strength)\s*:\s*)?$/i.test(prefix);
  const name=standaloneStrength ? medicationName(lines[index-1]??"") : medicationName(prefix);
  if(!name)continue;
  const source=[...(standaloneStrength?[lines[index-1]]:[]),line];
  const suffix=line.slice(dose.index+dose[0].length);
  let time=/(?:przypomnienie|reminder)/i.test(suffix)?"":suffix.match(CLOCK)?.[0]??"";
  const next=lines[index+1]??"";
  // Only a standalone clock or explicitly labelled adjacent dose time can extend a row.
  if(!time&&/^(?:(?:godzina(?:\s+dawki)?|time|dawkowanie|dosage)\s*:\s*)?(?:[01]\d|2[0-3]):[0-5]\d$/i.test(next)){
   time=next.match(CLOCK)![0];source.push(next);index++;
  }
  result.push({name,dose:dose[0],startedOn:"",takeTime:time,remindTime:"",sourceLine:source.join("\n").slice(0,500),doseSource:"strength"});
  if(result.length===5)break;
 }
 return result;
}
export function confirmedPrescription(value:unknown):PrescriptionCandidate[]|null {
 if(!Array.isArray(value)||!value.length||value.length>5)return null;
 const result:PrescriptionCandidate[]=[];
 for(const raw of value){if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;const r=raw as Record<string,unknown>;
  if(typeof r.name!=="string"||!r.name.trim()||r.name.trim().length>120||typeof r.dose!=="string"||!r.dose.trim()||r.dose.trim().length>120||!validIsoDate(r.startedOn)||typeof r.takeTime!=="string"||(r.takeTime&&!TIME_PATTERN.test(r.takeTime))||typeof r.remindTime!=="string"||(r.remindTime&&(!r.takeTime||!TIME_PATTERN.test(r.remindTime))))return null;
  result.push({name:r.name.trim(),dose:r.dose.trim(),startedOn:r.startedOn,takeTime:r.takeTime,remindTime:r.remindTime,sourceLine:""});
 }return result;
}
