import { T, DateText } from "@/components/preferences-provider";
import { LocalizedInput, LocalizedTextarea } from "@/components/localized-fields";
import { ManualSymptomForm } from "./manual-symptom-form";
import { createBaseline, createMedication, createSymptom, updateMedication } from "@/app/actions";
import { NaturalLanguageSymptomEntry } from "@/app/natural-language-symptom-entry";
import type { Medication, MedicationSymptomSource } from "@/lib/models";
import { dateLabel } from "@/lib/display";
import { SaveButton } from "./save-button";
export function MedicationEditForm({ medication }: { medication: Medication }) {
  const prefix = `edit-${medication.id}`;
  return <form action={updateMedication} className="space-y-4">
    <input type="hidden" name="medication_id" value={medication.id} />
    <div><label htmlFor={`${prefix}-name`} className="label"><T text="Nazwa leku" /></label><LocalizedInput id={`${prefix}-name`} name="name" defaultValue={medication.name} required maxLength={120} autoComplete="off" className="input" /></div>
    <div><label htmlFor={`${prefix}-dose`} className="label"><T text="Dawka" /></label><LocalizedInput id={`${prefix}-dose`} name="dose" defaultValue={medication.dose} required maxLength={120} className="input" /></div>
    <div><label htmlFor={`${prefix}-start`} className="label"><T text="Data rozpoczęcia" /></label><LocalizedInput id={`${prefix}-start`} name="started_on" type="date" defaultValue={medication.started_on} required className="input" /></div>
    <p className="section-copy"><T text="To korekta Twojego zapisu. Plan dawek i godziny edytujesz w planie dnia." /></p>
    <SaveButton><T text="Zapisz zmiany" /></SaveButton>
  </form>;
}
export function MedicationForm() { return <form action={createMedication} className="space-y-4"><div><label htmlFor="medication-name" className="label"><T text={"Nazwa leku"}/></label><LocalizedInput id="medication-name" name="name" required maxLength={120} autoComplete="off" placeholder="Nazwa z opakowania" className="input" /></div><div><label htmlFor="medication-dose" className="label"><T text={"Dawka"}/></label><LocalizedInput id="medication-dose" name="dose" required maxLength={120} placeholder="Np. 10 mg" className="input" /></div><div><label htmlFor="medication-start" className="label"><T text={"Data rozpoczęcia"}/></label><LocalizedInput id="medication-start" name="started_on" type="date" required className="input" /></div><SaveButton><T text={"Zapisz lek"}/></SaveButton></form>; }
export function BaselineForm({ medication }: { medication: Medication }) { return <form action={createBaseline} className="space-y-4"><input type="hidden" name="medication_id" value={medication.id} /><div><label htmlFor="baseline-description" className="label"><T text={"Jak się czułaś przed rozpoczęciem?"}/></label><LocalizedTextarea id="baseline-description" name="description" required maxLength={500} rows={3} placeholder="Krótka notatka o Twoim samopoczuciu" className="input resize-y" /></div><div><label htmlFor="baseline-date" className="label"><T text={"Data obserwacji"}/></label><LocalizedInput id="baseline-date" name="observed_on" type="date" max={medication.started_on} defaultValue={medication.started_on} required className="input" /><p className="mt-2 text-xs text-muted-foreground"><T text={"W dniu rozpoczęcia leku lub wcześniej:"}/><DateText value={medication.started_on}/></p></div><SaveButton><T text={"Zapisz samopoczucie przed lekiem"}/></SaveButton></form>; }
export function SymptomForm({ medication, sources = [] }: { medication: Medication; sources?: MedicationSymptomSource[] }) { return <><ManualSymptomForm medication={medication} sources={sources} /><details className="ai-entry mt-7"><summary><T text={"Wolisz opisać to własnymi słowami?"}/><span><T text={"Szkic AI"}/></span></summary><div className="mt-4"><NaturalLanguageSymptomEntry medicationId={medication.id} enabled={Boolean(process.env.OPENAI_API_KEY)} /></div></details></>; }
