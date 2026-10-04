import test from 'node:test';
import assert from 'node:assert/strict';
import {readLifeImpact,impactLabels} from '../src/lib/life-impact.ts';
import {compareMedicationDays,comparableCycleDays,observationKey,addPatternDays} from '../src/lib/personal-pattern.ts';
import {buildChartDays,chartWindow,recordedRating} from '../src/lib/personal-chart.ts';

const observation=(id,date,extra={})=>({kind:'symptom',id,date,symptom:'Ból głowy',groupId:'headache',severity:2,note:null,lifeImpacts:null,impactNote:null,medicationId:'med',medicationName:'Synthetic medicine',...extra});
test('chart days preserve individual observations and missing check-ins without zero values or interpolation',()=>{
 const symptoms=[observation('one','2026-10-02'),observation('two','2026-10-02',{severity:4}),observation('outside','2026-10-05')];
 const checkins=[{id:'daily',observed_on:'2026-10-03',mood:3,energy:null,sleep_hours:0,hydration:null,meals_regular:null,note:null}];
 const days=buildChartDays('2026-10-01','2026-10-04',symptoms,[],checkins,[]);
 assert.equal(days.length,4);assert.equal(days[0].checkin,null);assert.deepEqual(days[0].symptoms,[]);
 assert.equal(days[1].symptoms.length,2);assert.equal(days[1].checkin,null);assert.equal(days[2].checkin.energy,null);assert.equal(days[2].checkin.sleep_hours,0);assert.equal(days[3].symptoms.length,0);
});
test('chart medication and category filters do not reassign daily wellbeing or remove recorded bleeding',()=>{
 const meds=[{id:'med',name:'A',started_on:'2026-10-02'},{id:'other',name:'B',started_on:'2026-10-02'}];
 const symptoms=[observation('one','2026-10-02'),observation('other','2026-10-02',{medicationId:'other'}),observation('nausea','2026-10-02',{groupId:'nausea',symptom:'Nausea'})];
 const checkins=[{id:'daily',observed_on:'2026-10-02',mood:3}];
 const days=buildChartDays('2026-10-01','2026-10-03',symptoms,meds,checkins,[{id:'bleed',started_on:'2026-10-01',ended_on:'2026-10-03'}],'med','group:headache');
 assert.equal(days[1].symptoms.length,1);assert.equal(days[1].medicationStarts.length,1);assert.equal(days[1].checkin.mood,3);assert.equal(days[1].bleeding.length,1);
});
test('unknown bleeding ends mark only the recorded start and calendar windows reject future/invalid dates',()=>{
 const days=buildChartDays('2026-10-01','2026-10-03',[],[],[],[{id:'p',started_on:'2026-10-01',ended_on:null}]);
 assert.equal(days[0].bleeding.length,1);assert.equal(days[1].bleeding.length,0);
 assert.deepEqual(chartWindow('2026-10-04',7,'2026-10-04'),{from:'2026-09-28',to:'2026-10-04'});
 assert.equal(chartWindow('2026-10-05',7,'2026-10-04'),null);assert.equal(chartWindow('2026-02-30',7,'2026-10-04'),null);assert.equal(chartWindow('2026-10-04',31,'2026-10-04'),null);
 assert.throws(()=>buildChartDays('2026-01-01','2026-10-04',[],[],[],[]),RangeError);assert.throws(()=>buildChartDays('2026-10-05','2026-10-04',[],[],[],[]),RangeError);
 for(const value of [null,undefined,NaN,0,6,2.5])assert.equal(recordedRating(value),false);
 assert.equal(recordedRating(1),true);assert.equal(recordedRating(5),true);
});
test('life impact preserves unanswered vs explicitly no impact, validates and orders only user-selected answers',()=>{
 const data=new FormData();assert.deepEqual(readLifeImpact(data),{lifeImpacts:null,impactNote:null});
 data.append('life_impacts','none');assert.deepEqual(readLifeImpact(data).lifeImpacts,['none']);
 data.append('life_impacts','sleep');assert.equal(readLifeImpact(data),null);
 data.delete('life_impacts');data.append('life_impacts','sleep');data.append('life_impacts','work_study');data.set('impact_note','  My own words  ');
 assert.deepEqual(readLifeImpact(data),{lifeImpacts:['work_study','sleep'],impactNote:'My own words'});
 assert.deepEqual(impactLabels(['sleep','none'],'en'),['Sleep','I noticed no impact']);
 data.append('life_impacts','sleep');assert.equal(readLifeImpact(data),null);
 data.delete('life_impacts');data.append('life_impacts','diagnosis');assert.equal(readLifeImpact(data),null);
 data.delete('life_impacts');data.set('impact_note','a'.repeat(501));assert.equal(readLifeImpact(data),null);
 data.set('impact_note',new Blob(['file']),'file.txt');assert.equal(readLifeImpact(data),null);
});
test('AI candidate impact fields remain separate, indexed and explicitly entered',()=>{
 const data=new FormData();data.append('life_impacts_0','care');data.append('life_impacts_1','none');data.set('impact_note_0','Could not help at home');
 assert.deepEqual(readLifeImpact(data,'_0'),{lifeImpacts:['care'],impactNote:'Could not help at home'});
 assert.deepEqual(readLifeImpact(data,'_1'),{lifeImpacts:['none'],impactNote:null});
 assert.deepEqual(readLifeImpact(data,'_2'),{lifeImpacts:null,impactNote:null});
});
test('grouping connects known synonyms and keeps unsupported descriptions separate',()=>{
 assert.equal(observationKey({groupId:null,symptom:'Bóle głowy'}),observationKey({groupId:'headache',symptom:'Headache'}));
 assert.equal(observationKey({groupId:'invalid',symptom:'Moje pulsowanie'}),'text:moje pulsowanie');
 assert.notEqual(observationKey({groupId:null,symptom:'Moje pulsowanie'}),observationKey({groupId:null,symptom:'Inne pulsowanie'}));
});
test('comparison uses bounded calendar windows, distinct recorded days and prior history, not missing-day imputation',()=>{
 const items=[observation('old','2026-08-01'),observation('edge','2026-09-03'),observation('before','2026-09-30'),observation('start','2026-10-01'),observation('same-day','2026-10-01'),observation('future','2026-10-04'),observation('other','2026-10-02',{groupId:'nausea',symptom:'Nausea'})];
 const result=compareMedicationDays(items,'group:headache','2026-10-01','2026-10-03');
 assert.equal(result.beforeFrom,'2026-09-03');assert.equal(result.beforeDays,2);assert.equal(result.afterDays,1);assert.equal(result.after.length,2);assert.equal(result.priorHistory.length,3);assert.equal(result.afterTo,'2026-10-03');
 const empty=compareMedicationDays([],'group:headache','2026-10-01','2026-10-03');assert.equal(empty.beforeDays,0);assert.equal(empty.afterDays,0);assert.deepEqual(empty.after,[]);
 const future=compareMedicationDays(items,'group:headache','2026-11-01','2026-10-03');assert.ok(future.afterFrom>future.afterTo);assert.deepEqual(future.after,[]);
 const capped=compareMedicationDays([observation('late','2026-10-29')],'group:headache','2026-10-01','2026-11-01');assert.equal(capped.afterTo,'2026-10-28');assert.equal(capped.afterDays,0);
});
test('cycle comparison uses recorded day numbers without projecting over a shorter previous cycle',()=>{
 const periods=['2026-08-01','2026-08-20','2026-09-15'].map(started_on=>({started_on}));
 const result=comparableCycleDays('2026-10-04',periods,'natural','2026-10-04');
 assert.equal(result.status,'available');assert.equal(result.day,20);assert.deepEqual(result.dates,['2026-09-08']); // day 20 in the 19-day interval is excluded
 assert.deepEqual(comparableCycleDays('2026-10-04',periods,'affected','2026-10-04'),{status:'unavailable',reason:'context'});
 assert.equal(comparableCycleDays('2026-10-04',periods,'unknown','2026-10-04').status,'unavailable');
 assert.equal(comparableCycleDays('2026-10-04',[periods[2]],'natural','2026-10-04').status,'unavailable');
 assert.equal(comparableCycleDays('2026-11-01',periods,'natural','2026-11-01').status,'unavailable');
 assert.equal(comparableCycleDays('2026-10-05',periods,'natural','2026-10-04').reason,'date');
 assert.equal(comparableCycleDays('2026-02-30',periods,'natural','2026-10-04').reason,'date');
});
test('date arithmetic is stable at DST and year boundaries; duplicate/future starts do not add comparisons',()=>{
 assert.equal(addPatternDays('2026-10-25',1),'2026-10-26');assert.equal(addPatternDays('2026-01-01',-1),'2025-12-31');
 const periods=['2026-08-01','2026-09-01','2026-09-01','2026-11-01'].map(started_on=>({started_on}));
 assert.deepEqual(comparableCycleDays('2026-09-03',periods,'natural','2026-10-04'),{status:'available',day:3,referenceStart:'2026-09-01',dates:['2026-08-03']});
});
