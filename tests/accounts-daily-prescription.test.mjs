import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,tokenHash} from '../src/lib/password.ts';
import {localDate,localTime,scheduleApplies,validIsoDate,TIME_PATTERN} from '../src/lib/daily.ts';
import {parsePrescription,confirmedPrescription} from '../src/lib/prescription.ts';
import {validPushSubscription} from '../src/lib/push-validation.ts';
import {estimateCycle,cyclePhase} from '../src/lib/cycle-estimate.ts';
import {medicationColor} from '../src/lib/medication-color.ts';
import {shouldAskDailyContext,readMealsRegular} from '../src/lib/checkin.ts';

test('optional daily-context prompts appear for an okay or lower rating, without treating missing or invalid ratings as poor wellbeing',()=>{
 for(const rating of [1,2,3]){assert.equal(shouldAskDailyContext(rating,null),true);assert.equal(shouldAskDailyContext(null,rating),true);}
 assert.equal(shouldAskDailyContext(5,3),true);
 for(const [mood,energy] of [[null,null],[4,5],[0,6],[NaN,null],[2.5,null]])assert.equal(shouldAskDailyContext(mood,energy),false);
});
test('meal-context answers preserve missing and unsure responses and reject invented assessments',()=>{
 assert.equal(readMealsRegular(''),null);assert.equal(readMealsRegular(null),null);
 for(const answer of ['yes','no','unsure'])assert.equal(readMealsRegular(answer),answer);
 for(const answer of ['dehydrated','needs treatment',true,1,{}])assert.equal(readMealsRegular(answer),undefined);
});
test('medication artwork color is stable across name casing and spacing',()=>{
 const first=medicationColor('Provera');assert.deepEqual(first,medicationColor('  PROVERA  '));assert.match(first.hex,/^#[a-f0-9]{6}$/);assert.ok(first.hue>=0&&first.hue<360);assert.notDeepEqual(first,medicationColor('Ibuprofen'));
});
test('salted passwords verify without plaintext storage; corrupt hashes fail closed',async()=>{
 const password='Test-only passphrase 2026!',a=await hashPassword(password),b=await hashPassword(password);
 assert.notEqual(a,b);assert.equal(a.includes(password),false);assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('different',a),false);assert.equal(await verifyPassword(password,'scrypt:bad:bad'),false);assert.match(tokenHash(password),/^[a-f0-9]{64}$/);
});
test('daily schedule boundaries and date/time validation are explicit',()=>{
 assert.equal(scheduleApplies({active:true,starts_on:'2026-10-03',ends_on:'2026-10-03'},'2026-10-03'),true);
 assert.equal(scheduleApplies({active:false,starts_on:'2026-10-03',ends_on:null},'2026-10-03'),false);
 assert.equal(scheduleApplies({active:true,starts_on:'2026-10-04',ends_on:null},'2026-10-03'),false);
 assert.equal(validIsoDate('2026-02-30'),false);assert.equal(TIME_PATTERN.test('24:00'),false);assert.equal(TIME_PATTERN.test('08:30'),true);
 const now=new Date('2026-10-03T23:30:00Z');assert.equal(localDate('Europe/Warsaw',now),'2026-10-04');assert.equal(localDate('America/New_York',now),'2026-10-03');assert.equal(localTime('Europe/Warsaw',now),'01:30');
 // DST fallback retains the same local day and does not create an extra dose date.
 assert.equal(localDate('Europe/Warsaw',new Date('2026-10-25T00:30:00Z')),localDate('Europe/Warsaw',new Date('2026-10-25T01:30:00Z')));
});
test('prescription drafts copy explicit strengths/times but do not invent dosing or save without complete fields',()=>{
 const candidates=parsePrescription('Pacjent Anna\nProvera 10 mg 08:30\nIbuprofen 200 mg 2 razy dziennie\nNieznany lek bez dawki');
 assert.equal(candidates.length,2);assert.equal(candidates[0].name,'Provera');assert.equal(candidates[0].dose,'10 mg');assert.equal(candidates[0].takeTime,'08:30');assert.equal(candidates[0].startedOn,'');assert.equal(candidates[1].takeTime,'');
 assert.equal(confirmedPrescription(candidates),null);
 assert.ok(confirmedPrescription(candidates.map(c=>({...c,startedOn:'2026-10-03'}))));
 assert.equal(confirmedPrescription([{...candidates[0],startedOn:'2026-10-03',takeTime:'25:00'}]),null);
 assert.equal(confirmedPrescription([{...candidates[0],startedOn:'2026-10-03',takeTime:'',remindTime:'08:00'}]),null);
});
test('push subscriptions reject private hosts, attacker domains, malformed keys and non-HTTPS URLs',()=>{
 const valid={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};
 assert.equal(validPushSubscription(valid),true);
 for(const endpoint of ['https://localhost:15432/','http://fcm.googleapis.com/test','https://fcm.googleapis.com.evil.example/a','https://127.0.0.1/','https://user:pass@fcm.googleapis.com/a'])assert.equal(validPushSubscription({...valid,endpoint}),false);
 assert.equal(validPushSubscription({...valid,keys:{p256dh:'bad',auth:'bad'}}),false);
});
test('prescription drafts handle labelled names, adjacent strength/time lines and explicit units',()=>{
 const text='Nazwa leku: Menopur\n75 j.m.\nGodzina dawki: 08:30\n\nRp. Ibuprofen 200 mg\nLek: Provera 10 mg 21:00\nDrug: Example 0,5 mg/ml';
 const candidates=parsePrescription(text);
 assert.equal(candidates.length,4);
 assert.deepEqual(candidates.map(c=>[c.name,c.dose,c.takeTime]),[['Menopur','75 j.m.','08:30'],['Ibuprofen','200 mg',''],['Provera','10 mg','21:00'],['Example','0,5 mg/ml','']]);
 assert.ok(candidates.every(c=>c.startedOn===''&&c.remindTime===''));
 assert.equal(candidates[0].sourceLine,'Nazwa leku: Menopur\n75 j.m.\nGodzina dawki: 08:30');
});
test('prescription parser keeps missing instructions blank and does not associate patient metadata or reminder times with a dose',()=>{
 assert.deepEqual(parsePrescription('Pacjent: Anna\n10 mg\nIbuprofen\nData: 2026-10-03\n200 mg'),[]);
 assert.deepEqual(parsePrescription('Provera\n\n10 mg'),[]);
 const [candidate]=parsePrescription('Provera 10 mg Przypomnienie: 07:30\nData wystawienia: 2026-10-03');
 assert.equal(candidate.takeTime,'');assert.equal(candidate.startedOn,'');
 const [frequency]=parsePrescription('Ibuprofen 200 mg\n2 razy dziennie');
 assert.equal(frequency.takeTime,'');
});
test('Polish electronic prescriptions fill the name and literal DS instruction even when strength is not readable',()=>{
 const text='Informacja o receptach elektronicznych\nPacjent TEST\nWystawiono | 17 października 2019\nRecepta 1 z 1 ogółem\nPrzepisano | Menopur, proszek i rozpuszczalnik\ndo sporządzania roztworu do\nwstrzyki\nNo. 1 fiol. z proszkiem + 1\namp.-strz. po 1 ml ilość: 3\nDS, 1x1\nOdpłatność: R';
 const [candidate]=parsePrescription(text);
 assert.equal(candidate.name,'Menopur');assert.equal(candidate.dose,'1x1');assert.equal(candidate.doseSource,'instructions');
 assert.equal(candidate.startedOn,'');assert.equal(candidate.takeTime,'');assert.equal(candidate.remindTime,'');
 assert.equal(candidate.sourceLine,'Przepisano | Menopur, proszek i rozpuszczalnik\nDS, 1x1');
 assert.equal(candidate.sourceLine.includes('Pacjent'),false);
 assert.ok(confirmedPrescription([{...candidate,startedOn:'2026-10-04'}]));
});
test('electronic prescription blocks keep missing fields and other medications separate',()=>{
 const candidates=parsePrescription('Przepisano | Menopur, proszek\nNo. 1 fiol.\nOdpłatność: R\nRecepta 2 z 2 ogółem\nPrzepisano | Ibuprofen 200 mg\nDS: 1 tabletka o 08:30\nData rozpoczęcia: 2026-10-04\nOdpłatność: 100%');
 assert.equal(candidates.length,2);
 assert.equal(candidates[0].name,'Menopur');assert.equal(candidates[0].dose,'');assert.equal(candidates[0].doseSource,'missing');assert.equal(candidates[0].takeTime,'');assert.equal(candidates[0].startedOn,'');
 assert.equal(candidates[1].name,'Ibuprofen');assert.equal(candidates[1].dose,'200 mg');assert.equal(candidates[1].takeTime,'08:30');assert.equal(candidates[1].startedOn,'2026-10-04');
 assert.equal(confirmedPrescription(candidates),null);
});
test('a single recorded period permits only a declared-length illustration and keeps observed bleeding distinct',()=>{
 const periods=[{started_on:'2026-09-23',ended_on:'2026-09-27'}];
 assert.equal(estimateCycle('2026-10-03',periods,'natural').status,'insufficient');
 const estimate=estimateCycle('2026-10-03',periods,'natural',28);assert.equal(estimate.status,'estimated');assert.equal(estimate.basis,'declared');assert.equal(estimate.shortest,26);assert.equal(estimate.longest,30);
 assert.equal(cyclePhase('2026-09-25',periods,estimate),'menstrual');assert.equal(cyclePhase('2026-09-28',periods,estimate),'follicular');assert.equal(cyclePhase('2026-10-05',periods,estimate),'ovulation');assert.equal(cyclePhase('2026-10-15',periods,estimate),'luteal');
 assert.equal(estimateCycle('2026-10-03',periods,'affected',28).status,'insufficient');assert.equal(estimateCycle('2026-10-03',periods,'unknown',28).status,'insufficient');assert.equal(estimateCycle('2026-10-03',periods,'natural',0).status,'insufficient');
});
