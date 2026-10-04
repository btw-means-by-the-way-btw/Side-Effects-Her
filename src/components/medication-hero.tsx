"use client";
import { T, DateText } from "@/components/preferences-provider";

import Image from "next/image";
import { medicationColor } from "@/lib/medication-color";
import { useRef, type ReactNode } from "react";
import type { Medication } from "@/lib/models";
import { dateLabel } from "@/lib/display";
import { Icon } from "./icon";
export function MedicationHero({ medication, baselineSaved, children }: { medication: Medication; baselineSaved: boolean; children: ReactNode }) {
  const tint = medicationColor(medication.name);
  const ref = useRef<HTMLElement>(null);
  function reset() { for (const property of ["--art-x", "--art-y", "--art-r", "--spot-x", "--spot-y"]) ref.current?.style.removeProperty(property); }
  return <article ref={ref} className="medication-hero" onPointerLeave={reset} onPointerMove={event => { if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return; const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height; event.currentTarget.style.setProperty("--art-x", `${(x - .5) * 12}px`); event.currentTarget.style.setProperty("--art-y", `${(y - .5) * 9}px`); event.currentTarget.style.setProperty("--art-r", `${(x - .5) * 3}deg`); event.currentTarget.style.setProperty("--spot-x", `${x * 100}%`); event.currentTarget.style.setProperty("--spot-y", `${y * 100}%`); }}><div className="hero-art"><Image src="/design/assets/medication-sculpture.png" alt="" width={1254} height={1254} priority unoptimized style={{ filter: `hue-rotate(${tint.hue}deg) saturate(1.2) drop-shadow(0 16px 18px #18071665)` }} data-medication-color={tint.hex} /></div><span className="art-label"><T text={"Twój dziennik leku"}/></span><div className="hero-content"><p className="eyebrow"><T text={"Obserwowany lek"}/></p><div className="hero-title"><h2>{medication.name}</h2><span className="dose">{medication.dose}</span></div><p className="hero-meta"><Icon name="calendar" /><T text={"Zapis rozpoczęcia:"}/><DateText value={medication.started_on}/></p><p className="baseline-state"><Icon name={baselineSaved ? "check" : "info"} />{baselineSaved ? <T text={"Samopoczucie przed rozpoczęciem zapisane"}/> : <T text={"Zacznij od samopoczucia przed rozpoczęciem"}/>}</p><div className="hero-actions">{children}</div></div></article>;
}
