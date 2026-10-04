import nextEnv from '@next/env';
import postgres from 'postgres';
import webpush from 'web-push';
nextEnv.loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw Error('Configure DATABASE_URL and VAPID keys first.');
webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:notifications@sideeffecther.local',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
const sql=postgres(process.env.DATABASE_URL,{max:2,prepare:false});
let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
console.log('Side Effects Her reminder worker running (30-second interval).');
async function tick(){
 // Due date and clock use the account time zone, including DST. Never recommend a missed dose.
 const due=await sql`select s.id,a.id as account_id,a.locale,(now() at time zone a.timezone)::date::text as due_on
  from public.dose_schedules s join public.accounts a on a.workspace_id=s.workspace_id
  where s.active and s.remind_time is not null and s.starts_on <= (now() at time zone a.timezone)::date
   and (s.ends_on is null or s.ends_on >= (now() at time zone a.timezone)::date)
   and ((now() at time zone a.timezone)::date+s.remind_time) <= (now() at time zone a.timezone)
   and ((now() at time zone a.timezone)::date+s.remind_time) > (now() at time zone a.timezone)-interval '15 minutes'
   and not exists(select 1 from public.dose_intakes i where i.schedule_id=s.id and i.due_on=(now() at time zone a.timezone)::date)
   and not exists(select 1 from public.reminder_deliveries d where d.schedule_id=s.id and d.due_on=(now() at time zone a.timezone)::date)
   and exists(select 1 from public.push_subscriptions p where p.account_id=a.id)`;
 for(const dose of due){await sql.begin(async tx=>{
  // Claim per schedule/day transactionally; concurrent workers cannot double-send.
  const claimed=await tx`insert into public.reminder_deliveries(schedule_id,due_on) values(${dose.id},${dose.due_on}) on conflict do nothing returning schedule_id`;
  if(!claimed.length)return;
  const subscriptions=await tx`select endpoint,subscription from public.push_subscriptions where account_id=${dose.account_id}`;
  let success=false;
  for(const item of subscriptions){try{await webpush.sendNotification(item.subscription,JSON.stringify({locale:dose.locale}),{TTL:900,timeout:10000});success=true;}catch(error){if(error.statusCode===404||error.statusCode===410)await tx`delete from public.push_subscriptions where endpoint=${item.endpoint} and account_id=${dose.account_id}`;else console.error('Push delivery failed; will retry (no health data logged).');}}
  if(!success)await tx`delete from public.reminder_deliveries where schedule_id=${dose.id} and due_on=${dose.due_on}`;
 });}
}
while(!stopped){try{await tick();}catch{console.error('Reminder worker database operation failed.');}await new Promise(resolve=>setTimeout(resolve,30000));}
await sql.end();
