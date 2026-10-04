"use client";
import { impactLabels, type LifeImpactId } from "@/lib/life-impact";
import { useLocale } from "./preferences-provider";
export function LifeImpactSummary({ impacts, note }: { impacts: LifeImpactId[] | null; note: string | null }) {
  const locale = useLocale();
  if (!impacts?.length && !note) return null;
  return <div className="life-impact-summary"><strong>{locale === "en" ? "Your daily-life impact" : "Wpływ na Twoją codzienność"}</strong>
    {impacts?.length ? <p>{impactLabels(impacts, locale).join(" · ")}</p> : null}{note && <p className="whitespace-pre-wrap">{note}</p>}
  </div>;
}
