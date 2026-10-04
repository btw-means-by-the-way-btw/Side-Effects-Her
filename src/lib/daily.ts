export interface DoseSchedule { id:string;medication_id:string;name:string;dose:string;take_time:string;remind_time:string|null;starts_on:string;ends_on:string|null;active:boolean }
export interface DailyDose extends DoseSchedule {taken_at:string|null}
export const TIME_PATTERN=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function localDate(timezone:string,now=new Date()):string {return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function localTime(timezone:string,now=new Date()):string{return new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);}
export function validIsoDate(value:unknown):value is string {if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith("0000"))return false;const date=new Date(value+"T12:00:00Z");return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function scheduleApplies(schedule:Pick<DoseSchedule,"active"|"starts_on"|"ends_on">,date:string):boolean {return schedule.active&&schedule.starts_on<=date&&(!schedule.ends_on||schedule.ends_on>=date);}
