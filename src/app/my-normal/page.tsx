import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { getCycleProfile, getTimeline, listCycleCheckins, listCyclePeriods, listMedications, listPersonalObservations } from "@/lib/db";
import { localDate } from "@/lib/daily";
import { PersonalNormal } from "@/components/personal-normal";
import { T } from "@/components/preferences-provider";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moja norma | Side Effects Her", robots: { index: false, follow: false } };

export default async function MyNormalPage({ searchParams }: { searchParams: Promise<{ med?: string }> }) {
  const account = await requireAccount(), search = await searchParams;
  try {
    const [medications, observations, periods, checkins, profile] = await Promise.all([
      listMedications(account.workspace_id), listPersonalObservations(account.workspace_id),
      listCyclePeriods(account.workspace_id), listCycleCheckins(account.workspace_id), getCycleProfile(account.workspace_id),
    ]);
    const selected = medications.find(m => m.id === search.med) ?? medications[0];
    const timeline = selected ? await getTimeline(account.workspace_id, selected.id) : [];
    return <main className="page-shell"><PersonalNormal key={selected?.id ?? "empty"} medications={medications} selected={selected ?? null} observations={observations} periods={periods} checkins={checkins} cycleMode={profile?.mode ?? "unknown"} baseline={timeline.filter(item => item.kind === "baseline")} today={localDate(account.timezone)} /></main>;
  } catch {
    return <main className="page-shell"><h1 className="section-title"><T text="Moja norma" /></h1><p role="alert" className="notice-error mt-6"><T text="Nie udało się wczytać zapisów. Spróbuj odświeżyć stronę." /></p><Link href="/" className="text-button"><T text="← Twoje leki" /></Link></main>;
  }
}
