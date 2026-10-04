import {impactLabels} from "./life-impact.ts";
import {PDFDocument,rgb,type PDFPage,type PDFFont} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type {SummaryData} from "./summary-data";
import {CONTEXT_QUESTIONS} from "./context-questions.ts";
import {groupLabel} from "./symptom-groups.ts";
import {translate} from "./i18n.ts";
export async function makeSummaryPdf(data:SummaryData,regularBytes:Uint8Array,boldBytes:Uint8Array):Promise<Uint8Array> {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true});
 pdf.setTitle(data.locale==='en'?'Side Effects Her - clinician summary':'Side Effects Her - podsumowanie dla lekarza');pdf.setAuthor('Side Effects Her');
 const en=data.locale==='en',plum=rgb(.26,.16,.25),muted=rgb(.40,.36,.40),sage=rgb(.90,.94,.91);
 const t=(s:string)=>translate(s,data.locale);let page!:PDFPage,y=0;
 function newPage(){page=pdf.addPage([595.28,841.89]);y=765;page.drawText('Side Effects Her',{x:42,y:804,font:bold,size:11,color:plum});page.drawLine({start:{x:42,y:793},end:{x:553,y:793},thickness:.6,color:rgb(.85,.82,.85)});}
 function ensure(height:number){if(y-height<57)newPage();}
 function lines(text:string,font:PDFFont,size:number,width=511):string[]{const output:string[]=[];for(const paragraph of text.replace(/\r/g,'').split('\n')){let current='';for(const token of paragraph.split(/\s+/).filter(Boolean)){const parts:string[]=[];let chunk='';for(const character of token){if(font.widthOfTextAtSize(chunk+character,size)>width){parts.push(chunk);chunk=character;}else chunk+=character;}if(chunk)parts.push(chunk);for(const word of parts){const candidate=current?current+' '+word:word;if(current&&font.widthOfTextAtSize(candidate,size)>width){output.push(current);current=word;}else current=candidate;}}output.push(current||' ');}return output;}
 function write(text:string,size=10,font=regular,color=plum){const supported=new Set(font.getCharacterSet());const safe=[...text].map(char=>char==='\n'||char==='\r'||supported.has(char.codePointAt(0)!)?char:`[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`).join('');for(const line of lines(safe,font,size)){ensure(size*1.6);page.drawText(line,{x:42,y,font,size,color});y-=size*1.6;}y-=5;}
 function section(title:string){ensure(58);y-=14;page.drawRectangle({x:34,y:y-9,width:527,height:29,color:sage});page.drawText(title,{x:42,y,font:bold,size:12,color:plum});y-=33;}
 function entry(title:string,body:string){ensure(48);write(title,10,bold);if(body)write(body,9,regular,muted);}
 const date=(value:string)=>new Intl.DateTimeFormat(en?'en-GB':'pl-PL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));
 newPage();write(en?'Personal record for a clinician':'Osobisty zapis na wizytę u lekarza',20,bold);write(data.name,14,bold);write(`${en?'Generated':'Wygenerowano'}: ${date(data.generatedAt)} | ${data.timezone}`,9,regular,muted);
 write(en?'User-entered observations, not a diagnosis. Timing does not establish that a medication caused a symptom. No treatment or missed-dose recommendations.':'Obserwacje zapisane przez użytkowniczkę, nie diagnoza. Kolejność dat nie ustala, że lek spowodował objaw. Bez zaleceń leczenia i postępowania z pominiętą dawką.',10);
 section(en?'01 / Medications and personal timeline':'01 / Leki i osobista historia');
 if(!data.histories.length)write(en?'No medications recorded.':'Brak zapisanych leków.');
 for(const history of data.histories){const med=history.medication;entry(`${med.name} | ${med.dose}`,`${en?'Started':'Rozpoczęcie'}: ${date(med.started_on)}`);for(const item of history.timeline){const body=item.kind==='baseline'?item.description:item.kind==='medication'?item.dose:`${item.symptom} | ${en?'severity':'nasilenie'} ${item.severity}/5${item.note?'\n'+item.note:''}`;const impact=item.kind==="symptom"?[impactLabels(item.lifeImpacts,data.locale).join(", "),item.impactNote].filter(Boolean).join(" | "):""; entry(`${date(item.date)} - ${item.kind==='baseline'?(en?'Baseline':'Samopoczucie przed lekiem'):item.kind==='medication'?(en?'Medication start':'Rozpoczęcie leku'):(en?'Observation':'Obserwacja')}`,body+(impact?`\n${en?"User-reported daily-life impact":"Zgłoszony wpływ na codzienność"}: ${impact}`:""));}}
 section(en?'02 / Recorded bleeding':'02 / Zapisane krwawienie');
 if(!data.periods.length)write(en?'No records.':'Brak zapisów.');
 const flowEn:Record<string,string>={light:'light',medium:'medium',heavy:'heavy',unsure:'unsure'},flowPl:Record<string,string>={light:'niewielkie',medium:'umiarkowane',heavy:'obfite',unsure:'niepewne'};
 for(const period of data.periods)entry(`${date(period.started_on)} - ${period.ended_on?date(period.ended_on):(en?'end not recorded':'koniec nieznany')}`,`${period.flow?(en?flowEn:flowPl)[period.flow]:''}${period.note?'\n'+period.note:''}`);
 write(en?'These are recorded dates. Calendar phases or ovulation estimates are not measured findings and are not included as medical facts.':'To zapisane daty. Szacowane fazy cyklu i owulacja nie są pomiarami i nie są tu przedstawiane jako fakty medyczne.',9,regular,muted);
 section(en?'03 / Daily wellbeing':'03 / Codzienne samopoczucie');if(!data.checkins.length)write(en?'No check-ins.':'Brak zapisów samopoczucia.');
 for(const checkin of data.checkins)entry(date(checkin.observed_on),[checkin.mood!==null?`${en?'Mood':'Nastrój'} ${checkin.mood}/5`:null,checkin.energy!==null?`${en?'Energy':'Energia'} ${checkin.energy}/5`:null,checkin.sleep_hours!==null?`${en?'Sleep':'Sen'} ${checkin.sleep_hours} h`:null,checkin.hydration?`${en?'Hydration':'Woda'}: ${en?({less:"less than usual",usual:"as usual",more:"more than usual",unsure:"unsure"}[checkin.hydration]):({less:"mniej niż zwykle",usual:"jak zwykle",more:"więcej niż zwykle",unsure:"nie jestem pewna"}[checkin.hydration])}`:null,checkin.meals_regular?`${en?'Regular meals':'Regularne posiłki'}: ${en?({yes:'yes',no:'no',unsure:'unsure'}[checkin.meals_regular]):({yes:'tak',no:'nie',unsure:'nie jestem pewna'}[checkin.meals_regular])}`:null,checkin.note].filter(Boolean).join(' | '));
 section(en?'04 / Symptom context answers':'04 / Odpowiedzi o kontekście objawów');if(!data.answers.length)write(en?'No answers.':'Brak odpowiedzi.');
 const answerLabels=en?{yes:'yes',no:'no',unsure:'unsure'}:{yes:'tak',no:'nie',unsure:'nie jestem pewna'};
 for(const answer of data.answers)entry(`${date(answer.onset_on)} | ${answer.name} | ${answer.symptom}`,`${t(CONTEXT_QUESTIONS[answer.question_id as keyof typeof CONTEXT_QUESTIONS]??answer.question_id)} ${answerLabels[answer.answer]}`);
 section(en?'05 / User-entered dose schedules':'05 / Plany dawek wpisane przez użytkowniczkę');if(!data.schedules.length)write(en?'No schedules.':'Brak planów.');
 for(const s of data.schedules)entry(`${s.name} | ${s.dose} | ${s.take_time}`,`${date(s.starts_on)} - ${s.ends_on?date(s.ends_on):(en?'no end date':'bez daty końca')} | ${s.active?(en?'active':'aktywny'):(en?'paused':'zatrzymany')}${s.remind_time?` | ${en?'reminder':'przypomnienie'} ${s.remind_time}`:''}`);
 section(en?'06 / Marked dose intake':'06 / Oznaczone przyjęcia dawek');if(!data.intakes.length)write(en?'No doses marked taken.':'Brak oznaczonych przyjęć.');
 for(const intake of data.intakes)entry(`${date(intake.due_on)} ${intake.take_time} | ${intake.name} | ${intake.dose}`,`${en?'Marked at':'Oznaczono'}: ${new Intl.DateTimeFormat(en?'en-GB':'pl-PL',{dateStyle:'short',timeStyle:'short',timeZone:data.timezone}).format(new Date(intake.taken_at))}`);
 section(en?'07 / Source phrases - separate from observations':'07 / Frazy źródłowe - osobno od obserwacji');
 let quotes=0;for(const history of data.histories){for(const source of history.index.sources){quotes++;entry(`${history.medication.name} | ${groupLabel(source.symptom_group_id,data.locale)??source.symptom_group_id}`,`"${source.exact_phrase}"\n${en?"FDA label":"Etykieta FDA"}: ${source.label_id}${source.label_effective_time?' | '+source.label_effective_time:''}\n${source.source_url}`);}}
 if(!quotes)write(en?'No verified source phrases in the available index. Missing information does not rule out an effect.':'Brak zweryfikowanych fraz w dostępnym indeksie. Brak informacji nie wyklucza działania leku.');
 write(en?'The source index is partial. Quotes are text matches, not causal conclusions. Check the full label and exact product. Spontaneous adverse-event reports do not establish causality and are not incidence or clinical risk.':'Indeks źródeł jest częściowy. Cytaty są dopasowaniem tekstu, nie wnioskiem o przyczynie. Sprawdź pełną etykietę i konkretny produkt. Spontaniczne zgłoszenia nie ustalają przyczynowości i nie oznaczają częstości występowania ani ryzyka klinicznego.',9,regular,muted);
 section(en?'Questions for the appointment':'Pytania na wizytę');for(let i=0;i<3;i++){ensure(35);page.drawLine({start:{x:42,y:y-20},end:{x:553,y:y-20},thickness:.6,color:rgb(.85,.82,.85)});y-=35;}
 const pages=pdf.getPages();pages.forEach((p,index)=>p.drawText(`Side Effects Her | ${index+1} / ${pages.length}`,{x:42,y:30,font:regular,size:8,color:muted}));
 return pdf.save();
}

