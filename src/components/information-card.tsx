import type { ReactNode } from "react";
import {T} from "./preferences-provider";

type Tone = "experience" | "official" | "reports" | "limitations";

const tones: Record<Tone, { surface: string; marker: string; eyebrow: string }> = {
  experience: { surface: "border-primary/20 bg-secondary/70", marker: "bg-primary text-primary-foreground", eyebrow: "text-primary" },
  official: { surface: "border-evidence/20 bg-accent/70", marker: "bg-evidence text-white", eyebrow: "text-accent-foreground" },
  reports: { surface: "border-border bg-card", marker: "bg-reports text-white", eyebrow: "text-reports" },
  limitations: { surface: "border-border bg-muted", marker: "bg-card text-muted-foreground", eyebrow: "text-muted-foreground" },
};

export function InformationCard({ id, tone, number, eyebrow, title, description, children }: {
  id: string;
  tone: Tone;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const style = tones[tone];
  return <section id={id} aria-labelledby={`${id}-title`} className={`information-card scroll-mt-6 border p-5 sm:p-8 ${style.surface}`}>
    <div className="information-card-header flex items-start gap-4 sm:gap-5">
      <span aria-hidden="true" className="information-number shrink-0 text-primary">{number}</span>
      <div>
        <p className={`eyebrow ${style.eyebrow}`}><T text={eyebrow}/></p>
        <h2 id={`${id}-title`} className="mt-2 text-foreground"><T text={title}/></h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground"><T text={description}/></p>
      </div>
    </div>
    {children}
  </section>;
}
