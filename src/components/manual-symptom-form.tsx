"use client";
import {useState} from "react";
import {createSymptom} from "@/app/actions";
import type {Medication,MedicationSymptomSource} from "@/lib/models";
import {SaveButton} from "./save-button";
import {SymptomLabelHint} from "./symptom-label-hint";
import {useT} from "./preferences-provider";
import {LifeImpactFields} from "./life-impact-fields";
export function ManualSymptomForm({medication,sources}:{medication:Medication;sources:MedicationSymptomSource[]}) {
 const [symptom,setSymptom]=useState(""),t=useT();
 return <form action={createSymptom} className="space-y-4"><input type="hidden" name="medication_id" value={medication.id}/><div><label htmlFor="symptom" className="label">{t("Objaw lub zmiana")}</label><input id="symptom" name="symptom" required maxLength={120} placeholder={t("Opisz własną obserwację")} value={symptom} onChange={e=>setSymptom(e.target.value)} className="input"/></div><SymptomLabelHint symptom={symptom} sources={sources} medicationId={medication.id}/><div><label htmlFor="severity" className="label">{t("Nasilenie — Twoja ocena")}</label><select id="severity" name="severity" required defaultValue="" className="input"><option value="" disabled>{t("Wybierz 1–5")}</option><option value="1">{t("1 / 5 — niewielkie")}</option><option value="2">2 / 5</option><option value="3">3 / 5</option><option value="4">4 / 5</option><option value="5">{t("5 / 5 — duże")}</option></select></div><div><label htmlFor="onset_on" className="label">{t("Kiedy się pojawił?")}</label><input id="onset_on" name="onset_on" type="date" required className="input"/></div><div><label htmlFor="note" className="label">{t("Notatka")} {t("(opcjonalnie)")}</label><textarea id="note" name="note" maxLength={1000} rows={3} placeholder={t("Co chcesz zapamiętać?")} className="input resize-y"/></div><LifeImpactFields /><SaveButton>{t("Zapisz obserwację")}</SaveButton></form>;
}
