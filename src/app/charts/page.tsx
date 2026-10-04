import { requireAccount } from "@/lib/auth";
import { listCycleCheckins, listCyclePeriods, listMedications, listPersonalObservations } from "@/lib/db";
import { localDate } from "@/lib/daily";
import { PersonalCharts } from "@/components/personal-charts";
import { T } from "@/components/preferences-provider";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wykresy | Side Effects Her", robots: { index: false, follow: false } };

export default async function ChartsPage({ searchParams }: { searchParams: Promise<{ med?: string }> }) {
  const account = await requireAccount(), search = await searchParams;
  try {
    const [medications, observations, checkins, periods] = await Promise.all([
      listMedications(account.workspace_id), listPersonalObservations(account.workspace_id),
      listCycleCheckins(account.workspace_id), listCyclePeriods(account.workspace_id),
    ]);
    const medicationId = medications.some(med => med.id === search.med) ? search.med! : "";
    return <main className="page-shell"><PersonalCharts key={medicationId} medications={medications} observations={observations} checkins={checkins} periods={periods} initialMedication={medicationId} today={localDate(account.timezone)} /></main>;
  } catch {
    return <main className="page-shell"><h1 className="section-title"><T text="Wykresy" /></h1><p role="alert" className="notice-error mt-6"><T text="Nie udało się wczytać zapisów. Spróbuj odświeżyć stronę." /></p><Link className="text-button" href="/"><T text="← Twoje leki" /></Link></main>;
  }
}
