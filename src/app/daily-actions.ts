"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAccount} from "@/lib/auth";
import {db,findMedication} from "@/lib/db";
import {dateField,field,uuidField} from "@/lib/validation";
import {localDate,TIME_PATTERN} from "@/lib/daily";
export async function saveSchedule(data:FormData):Promise<void> {
 const account=await requireAccount(),med=uuidField(data,"medication_id"),dose=field(data,"dose",120),take=String(data.get("take_time")??""),remind=String(data.get("remind_time")??""),start=dateField(data,"starts_on"),rawEnd=data.get("ends_on"),end=rawEnd?dateField(data,"ends_on"):null;
 if(!med||!dose||!TIME_PATTERN.test(take)||(remind&&!TIME_PATTERN.test(remind))||!start||(rawEnd&&!end)||(end&&end<start)||!await findMedication(account.workspace_id,med)) redirect("/schedule?error=Check%20medication%2C%20dose%20and%20dates");
 await db()`insert into public.dose_schedules(workspace_id,medication_id,dose,take_time,remind_time,starts_on,ends_on) values(${account.workspace_id},${med},${dose},${take},${remind||null},${start},${end})`;
 revalidatePath("/");redirect("/schedule?saved=1");
}
export async function setScheduleActive(data:FormData):Promise<void> {
 const account=await requireAccount(),id=uuidField(data,"schedule_id"),active=data.get("active");
 if(!id||!["true","false"].includes(active as string))return;
 await db()`update public.dose_schedules set active=${active==="true"} where workspace_id=${account.workspace_id} and id=${id}`;
 revalidatePath("/");revalidatePath("/schedule");
}
export async function setTaken(data:FormData):Promise<void> {
 const account=await requireAccount(),id=uuidField(data,"schedule_id"),date=dateField(data,"due_on"),taken=data.get("taken");
 if(!id||!date||date!==localDate(account.timezone)||!["true","false"].includes(taken as string))return;
 const rows=await db()`select 1 from public.dose_schedules where id=${id} and workspace_id=${account.workspace_id} and active and starts_on<=${date} and (ends_on is null or ends_on>=${date})`;
 if(!rows.length)return;
 if(taken==="true")await db()`insert into public.dose_intakes(schedule_id,workspace_id,due_on) values(${id},${account.workspace_id},${date}) on conflict(schedule_id,due_on) do nothing`;
 else await db()`delete from public.dose_intakes where schedule_id=${id} and workspace_id=${account.workspace_id} and due_on=${date}`;
 revalidatePath("/");
}
