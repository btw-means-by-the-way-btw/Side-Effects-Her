import "server-only";
import {db} from "./db";
import type {DoseSchedule,DailyDose} from "./daily";
export async function getSchedules(workspace:string):Promise<DoseSchedule[]> {
 const rows=await db()<DoseSchedule[]>`select s.id,s.medication_id,m.name,s.dose,to_char(s.take_time,'HH24:MI') as take_time,to_char(s.remind_time,'HH24:MI') as remind_time,s.starts_on::text,s.ends_on::text,s.active from public.dose_schedules s join public.medications m on m.id=s.medication_id and m.workspace_id=s.workspace_id where s.workspace_id=${workspace} order by s.active desc,s.take_time,m.name`;
 return [...rows];
}
export async function getDaily(workspace:string,date:string):Promise<DailyDose[]> {
 const rows=await db()<DailyDose[]>`select s.id,s.medication_id,m.name,s.dose,to_char(s.take_time,'HH24:MI') as take_time,to_char(s.remind_time,'HH24:MI') as remind_time,s.starts_on::text,s.ends_on::text,s.active,i.taken_at::text from public.dose_schedules s join public.medications m on m.id=s.medication_id and m.workspace_id=s.workspace_id left join public.dose_intakes i on i.schedule_id=s.id and i.workspace_id=s.workspace_id and i.due_on=${date} where s.workspace_id=${workspace} and s.active and s.starts_on<=${date} and (s.ends_on is null or s.ends_on>=${date}) order by s.take_time,m.name`;
 return [...rows];
}
