"use client";

import { useId, useState } from "react";
import { recordCycleCheckin } from "@/app/actions";
import type { CycleCheckin } from "@/lib/models";
import { shouldAskDailyContext } from "@/lib/checkin";
import { hydrationLabel } from "@/lib/display";
import { LocalizedOption } from "./localized-fields";
import { useLocale, T } from "./preferences-provider";
import { SaveButton } from "./save-button";
import { Icon } from "./icon";

export function WellbeingCheckinForm({ initialDate, checkins, med, returnTo = "cycle" }: {
  initialDate: string; checkins: CycleCheckin[]; med?: string; returnTo?: "home" | "cycle";
}) {
  const en = useLocale() === "en", prefix = useId();
  const [date, setDate] = useState(initialDate);
  const existing = checkins.find(item => item.observed_on === date);
  return <div>
    <label htmlFor={`${prefix}-date`} className="label">{en ? "Observation date" : "Data obserwacji"}</label>
    <input id={`${prefix}-date`} form={`${prefix}-form`} className="input mb-5" type="date" max={initialDate} value={date} onInput={event => { if (event.currentTarget.value) setDate(event.currentTarget.value); }} onChange={event => setDate(event.target.value)} required />
    <CheckinFields key={date} formId={`${prefix}-form`} date={date} existing={existing} med={med} returnTo={returnTo} />
  </div>;
}

function CheckinFields({ formId, date, existing, med, returnTo }: { formId: string; date: string; existing?: CycleCheckin; med?: string; returnTo: "home" | "cycle" }) {
  const en = useLocale() === "en", prefix = useId();
  const [mood, setMood] = useState(existing?.mood?.toString() ?? "");
  const [energy, setEnergy] = useState(existing?.energy?.toString() ?? "");
  const [expanded, setExpanded] = useState(false);
  const askContext = shouldAskDailyContext(mood ? Number(mood) : null, energy ? Number(energy) : null);
  const hasContext = Boolean(existing && (existing.hydration || existing.meals_regular || existing.sleep_hours !== null));
  const showContext = askContext || expanded || hasContext;
  const moodLabels = en ? ["Very low", "Low", "Okay", "Good", "Very good"] : ["Bardzo słabo", "Słabo", "Średnio", "Dobrze", "Bardzo dobrze"];

  return <form id={formId} action={recordCycleCheckin} className="space-y-5">
    <input type="hidden" name="observed_on" value={date} />
    <input type="hidden" name="return_medication_id" value={med ?? ""} />
    <input type="hidden" name="return_to" value={returnTo} />
    <div>
      <label htmlFor={`${prefix}-mood`} className="label">{en ? "How is your mood today?" : "Jak się dziś czujesz?"}</label>
      <select id={`${prefix}-mood`} className="input" name="mood" value={mood} onChange={event => setMood(event.target.value)}>
        <LocalizedOption value="">Bez zapisu</LocalizedOption>
        {moodLabels.map((label, index) => <option key={index} value={index + 1}>{label} · {index + 1}/5</option>)}
      </select>
      <p className="section-copy">{en ? "Your own mood rating, not a medical assessment." : "Twoja własna ocena nastroju i samopoczucia, nie ocena medyczna."}</p>
    </div>
    <div>
      <label htmlFor={`${prefix}-energy`} className="label">{en ? "Energy" : "Energia"}</label>
      <select id={`${prefix}-energy`} className="input" name="energy" value={energy} onChange={event => setEnergy(event.target.value)}>
        <LocalizedOption value="">Bez zapisu</LocalizedOption>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score} / 5</option>)}
      </select>
      <p className="section-copy">{en ? "1 = very low, 5 = very high" : "1 = bardzo niska, 5 = bardzo wysoka"}</p>
    </div>
    {askContext && <p role="status" className="gentle-note"><Icon name="wave" />{en ? "Want to add a little context to this day? These questions are optional." : "Chcesz dodać trochę kontekstu do tego dnia? Te pytania są opcjonalne."}</p>}
    {!showContext && <button type="button" className="button-quiet" onClick={() => setExpanded(true)}>{en ? "Add water, meals and sleep" : "Dodaj wodę, posiłki i sen"}</button>}
    <fieldset hidden={!showContext} onChange={() => setExpanded(true)} className="space-y-4 rounded-2xl bg-secondary/40 p-4 border-0 min-w-0">
      <legend className="label px-2">{en ? "A few small questions" : "Kilka małych pytań"}</legend>
      <div>
        <label htmlFor={`${prefix}-water`} className="label">{en ? "How much water did you drink compared with your usual day?" : "Czy piłaś wodę jak w zwykły dzień?"}</label>
        <select id={`${prefix}-water`} name="hydration" defaultValue={existing?.hydration ?? ""} className="input">
          <LocalizedOption value="">Bez odpowiedzi</LocalizedOption>{Object.entries(hydrationLabel).map(([value, label]) => <LocalizedOption key={value} value={value}>{label}</LocalizedOption>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-meals`} className="label">{en ? "Did you eat regular meals that day?" : "Czy tego dnia jadłaś regularne posiłki?"}</label>
        <select id={`${prefix}-meals`} name="meals_regular" defaultValue={existing?.meals_regular ?? ""} className="input">
          <LocalizedOption value="">Bez odpowiedzi</LocalizedOption>
          <option value="yes">{en ? "Yes" : "Tak"}</option><option value="no">{en ? "No — irregular or skipped meals" : "Nie — nieregularnie lub pominęłam posiłek"}</option><option value="unsure">{en ? "Unsure" : "Nie jestem pewna"}</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-sleep`} className="label">{en ? "How many hours did you sleep the night before?" : "Ile godzin spałaś poprzedniej nocy?"}</label>
        <input id={`${prefix}-sleep`} type="number" name="sleep_hours" min="0" max="24" step="0.1" defaultValue={existing?.sleep_hours ?? ""} className="input" />
      </div>
      <p className="section-copy">{en ? "These answers record your day. They do not establish whether water, meals, sleep, your cycle or a medication caused how you feel." : "Odpowiedzi opisują Twój dzień. Nie ustalają, czy samopoczucie wynika z wody, posiłków, snu, cyklu lub leku."}</p>
    </fieldset>
    <div><label htmlFor={`${prefix}-note`} className="label">{en ? "Anything else to remember? (optional)" : "Co jeszcze chcesz zapamiętać? (opcjonalnie)"}</label><textarea id={`${prefix}-note`} name="note" maxLength={500} rows={2} defaultValue={existing?.note ?? ""} className="input resize-y" /></div>
    {existing && <p className="section-copy">{en ? "Your existing entry for this day is loaded. Saving updates it." : "Wczytano Twój istniejący zapis z tego dnia. Zapisanie zaktualizuje go."}</p>}
    <SaveButton><T text="Zapisz samopoczucie" /></SaveButton>
    <p className="text-xs leading-5 text-muted-foreground"><T text="Nowy zapis dla tej samej daty zastąpi poprzednie wartości tego dnia." /></p>
  </form>;
}
