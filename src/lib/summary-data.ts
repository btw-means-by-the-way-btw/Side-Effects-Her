import "server-only";
import {db,getTimeline,getMedicationSymptomIndex,listMedications} from "./db";
import type {Account} from "./auth";
import type {CyclePeriod,CycleCheckin,SymptomContextAnswer} from "./models";
import {getSchedules} from "./daily-db";
export async function summaryData(account:Account) {
 const workspace=account.workspace_id;
 const [medications,periods,checkins,schedules,intakes,answers]=await Promise.all([
  listMedications(workspace),
  db()<CyclePeriod[]>`select id,started_on::text,ended_on::text,flow,note from public.cycle_periods where workspace_id=${workspace} order by started_on`,
  db()<CycleCheckin[]>`select id,observed_on::text,mood,energy,sleep_hours::float8,hydration,meals_regular,note from public.cycle_checkins where workspace_id=${workspace} order by observed_on`,
  getSchedules(workspace),
  db()<{name:string;dose:string;due_on:string;take_time:string;taken_at:string}[]>`select m.name,s.dose,i.due_on::text,to_char(s.take_time,'HH24:MI') as take_time,i.taken_at::text from public.dose_intakes i join public.dose_schedules s on s.id=i.schedule_id and s.workspace_id=i.workspace_id join public.medications m on m.id=s.medication_id and m.workspace_id=s.workspace_id where i.workspace_id=${workspace} order by i.due_on,s.take_time`,
  db()<(SymptomContextAnswer&{symptom_event_id:string;symptom:string;onset_on:string;name:string})[]>`select a.symptom_event_id,a.question_id,a.answer,e.symptom,e.onset_on::text,m.name from public.symptom_context_answers a join public.symptom_events e on e.id=a.symptom_event_id and e.workspace_id=a.workspace_id join public.medications m on m.id=e.medication_id and m.workspace_id=e.workspace_id where a.workspace_id=${workspace} and e.deleted_at is null order by e.onset_on,a.question_id`
 ]);
 const histories=await Promise.all(medications.map(async medication=>({medication,timeline:await getTimeline(workspace,medication.id),index:await getMedicationSymptomIndex(workspace,medication.id)})));
 return {name:account.display_name,locale:account.locale,timezone:account.timezone,generatedAt:new Date().toISOString(),histories,periods:[...periods],checkins:[...checkins],schedules,intakes:[...intakes],answers:[...answers]};
}
export type SummaryData=Awaited<ReturnType<typeof summaryData>>;
