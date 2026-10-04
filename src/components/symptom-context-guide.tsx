import { T } from "@/components/preferences-provider";
import Link from "next/link";
import type { CycleCheckin, CyclePeriod, SymptomContextAnswer } from "@/lib/models";
import type { SymptomGroupId } from "@/lib/symptom-groups";
import { observedCycleDay } from "@/lib/cycle-context";
import { hydrationLabel, mealsLabel } from "@/lib/display";
import { CONTEXT_QUESTIONS, type ContextQuestionId } from "@/lib/context-questions";
import { CYCLE_SOURCES } from "@/lib/cycle-estimate";
import { Icon } from "./icon";

export function SymptomContextGuide({ date, groupId, periods, checkin, answers, medicationId }: { date: string; groupId: SymptomGroupId | null; periods: CyclePeriod[]; checkin?: CycleCheckin; answers: SymptomContextAnswer[]; medicationId: string }) {
  const cycle = observedCycleDay(date, periods);
  const facts = [
    cycle && `Dzień ${cycle.day} od zapisanego początku krwawienia${cycle.bleedingRecorded ? "; krwawienie zapisane" : ""}.`,
    checkin?.hydration && `Twój zapis samopoczucia: picie wody — ${hydrationLabel[checkin.hydration]}.`,
    checkin?.meals_regular && `Twój zapis samopoczucia: posiłki — ${mealsLabel[checkin.meals_regular]}.`,
    checkin?.sleep_hours != null && `Twój zapis samopoczucia: sen — ${checkin.sleep_hours} godzin.`,
    checkin?.mood != null && `Twój zapis samopoczucia: nastrój — ${checkin.mood}/5.`,
    checkin?.energy != null && `Twój zapis samopoczucia: energia — ${checkin.energy}/5.`,
  ].filter((fact): fact is string => typeof fact === "string");
  const answerLabel = { yes: "tak", no: "nie", unsure: "nie jestem pewna" };
  const headache = groupId === "headache";
  const cycleRelevant = ["headache", "mood_change", "sleep_change", "fatigue", "breast_discomfort", "pelvic_pain", "abdominal_pain", "appetite_change", "skin_reaction"].includes(groupId ?? "");
  return <section className="context-guide mt-6" aria-labelledby="context-guide-title"><p className="step"><T text={"Zapisane fakty + informacje ogólne"}/></p><h2 id="context-guide-title" className="section-title"><T text={"Co warto sprawdzić w swoim dniu?"}/></h2>
    <p className="section-copy"><T text={"Woda, sen, codzienne okoliczności i cykl mogą być tematami do rozmowy. Nie wybieramy spośród nich przyczyny Twojego objawu."}/></p>
    {facts.length > 0 && <div className="context-facts"><h3><T text={"Twoje zapisy z tego dnia"}/></h3><ul>{facts.map(fact => <li key={fact}><Icon name="check" /><T text={fact}/></li>)}</ul></div>}
    {answers.length > 0 && <div className="context-facts"><h3><T text={"Twoje zapisane odpowiedzi"}/></h3><ul>{answers.filter(answer => answer.question_id in CONTEXT_QUESTIONS).map(answer => <li key={answer.question_id}><span><T text={CONTEXT_QUESTIONS[answer.question_id as ContextQuestionId]}/> <strong><T text={answerLabel[answer.answer]}/></strong></span></li>)}</ul><p><T text={"Odpowiedź „nie” nie wyklucza przyczyny; odpowiedź „tak” jej nie potwierdza."}/></p></div>}
    {!facts.length && !answers.length && <p className="notice"><T text={"Jeszcze bez kontekstu dla tej daty. Pytania poniżej pomogą go zapisać."}/></p>}
    {headache && <article className="context-source"><p className="eyebrow text-evidence"><T text={"Informacja ogólna · NHS"}/></p><h3><T text={"Ból głowy ma wiele możliwych kontekstów."}/></h3><p><T text={"NHS wymienia m.in. niedobór płynów, nieregularne posiłki, stres i miesiączkę wśród możliwych przyczyn bólu głowy. Ta lista nie ustala, co spowodowało Twój objaw. Pytamy o to, co sama zauważyłaś."}/></p><a className="text-link" href="https://www.nhs.uk/symptoms/headaches/" target="_blank" rel="noopener noreferrer"><T text={"Przeczytaj źródło NHS ↗"}/></a></article>}
    {cycleRelevant && <article className="context-source"><p className="eyebrow text-evidence"><T text={"Informacja ogólna · NHS"}/></p><h3><T text={"Cykl może towarzyszyć zmianom samopoczucia."}/></h3><p><T text={"NHS opisuje zmiany samopoczucia przed miesiączką. Zbieżność dat nie rozpoznaje PMS i nie pozwala przypisać objawu cyklowi ani wykluczyć leku lub innej przyczyny."}/></p><a className="text-link" href={CYCLE_SOURCES.wellbeing} target="_blank" rel="noopener noreferrer"><T text={"Źródło o objawach przed miesiączką ↗"}/></a><Link className="text-link" href={`/cycle?med=${medicationId}`}><T text={"Zobacz mapę i ograniczenia cyklu →"}/></Link></article>}
    {headache && <p className="notice-attention mt-4"><T text={"Nagły, bardzo silny ból głowy albo ból z osłabieniem, trudnością mówienia lub utratą widzenia wymaga pilnej pomocy medycznej. Pytania o kontekst nie służą do oceny pilności."}/><a className="underline" href="https://www.nhs.uk/symptoms/headaches/" target="_blank" rel="noopener noreferrer"><T text={"Źródło: NHS"}/></a>.</p>}
  </section>;
}

