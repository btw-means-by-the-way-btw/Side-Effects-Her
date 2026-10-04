"use client";
import { useId, useState } from "react";
import { LIFE_IMPACTS, type LifeImpactId } from "@/lib/life-impact";
import { useLocale } from "./preferences-provider";

export function LifeImpactFields({ suffix = "", initialImpacts = null, initialNote = null }: { suffix?: string; initialImpacts?: LifeImpactId[] | null; initialNote?: string | null }) {
  const locale = useLocale(), en = locale === "en", id = useId();
  const [selected, setSelected] = useState<LifeImpactId[]>(initialImpacts ?? []);
  function toggle(value: LifeImpactId, checked: boolean) {
    setSelected(current => !checked ? current.filter(item => item !== value) : value === "none" ? [value] : [...current.filter(item => item !== "none"), value]);
  }
  return <fieldset className="life-impact-fields">
    <legend>{en ? "This affects my life" : "To wpływa na moje życie"}</legend>
    <p>{en ? "What was harder because of this observation? Optional; select only what you noticed." : "Co było przez to trudniejsze? Opcjonalnie — zaznacz tylko to, co zauważyłaś."}</p>
    <div className="life-impact-options">{LIFE_IMPACTS.map(option => <label key={option.id} className={selected.includes(option.id) ? "selected" : ""}>
      <input name={`life_impacts${suffix}`} value={option.id} type="checkbox" checked={selected.includes(option.id)} onChange={event => toggle(option.id, event.target.checked)} />{option[locale]}
    </label>)}</div>
    <label htmlFor={id} className="label mt-4">{en ? "Describe it in your own words (optional)" : "Opisz to własnymi słowami (opcjonalnie)"}</label>
    <textarea id={id} name={`impact_note${suffix}`} defaultValue={initialNote ?? ""} rows={2} maxLength={500} className="input resize-y" />
    <p>{en ? "No selection means unanswered. These answers are not used to diagnose or assess urgency." : "Brak zaznaczenia oznacza brak odpowiedzi. Te odpowiedzi nie służą do diagnozy ani oceny pilności."}</p>
  </fieldset>;
}
