"use server";
import {redirect} from "next/navigation";
import {after} from "next/server";
import {requireAccount} from "@/lib/auth";
import {db,findMedication} from "@/lib/db";
import {confirmedPrescription} from "@/lib/prescription";
import {openFdaSource} from "@/lib/evidence/server";
import {ensureMedicationSymptomIndex} from "@/lib/classification/medication-index";
export async function savePrescription(data:FormData):Promise<void> {
 const account=await requireAccount();let draft;
 const raw=data.get("candidates");if(data.get("confirmed")!=="on"||typeof raw!=="string"||raw.length>6000)redirect("/prescription?error=Review%20and%20confirm%20the%20draft");
 try{draft=confirmedPrescription(JSON.parse(raw));}catch{draft=null;}
 if(!draft)redirect("/prescription?error=Check%20every%20medication%2C%20dose%20and%20date");
 const candidates=draft;
 const ids=await db().begin(async tx=>{const saved:string[]=[];
  for(const c of candidates){const rows=await tx<{id:string}[]>`insert into public.medications(workspace_id,name,dose,started_on) values(${account.workspace_id},${c.name},${c.dose},${c.startedOn}) returning id`;const id=rows[0].id;
   await tx`insert into public.medication_events(workspace_id,medication_id,event_type,occurred_on,dose_snapshot) values(${account.workspace_id},${id},'started',${c.startedOn},${c.dose})`;
   if(c.takeTime)await tx`insert into public.dose_schedules(workspace_id,medication_id,dose,take_time,remind_time,starts_on) values(${account.workspace_id},${id},${c.dose},${c.takeTime},${c.remindTime||null},${c.startedOn})`;
   saved.push(id);
  }return saved;
 });
 after(async()=>{for(const id of ids){try{const med=await findMedication(account.workspace_id,id);if(med)await ensureMedicationSymptomIndex(account.workspace_id,med,await openFdaSource().lookupLabels(med.name));}catch{console.error("Prescription label indexing unavailable");}}});
 redirect(`/?med=${ids[0]}&saved=medication`);
}
