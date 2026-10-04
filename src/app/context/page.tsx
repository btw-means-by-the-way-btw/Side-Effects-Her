import { T, DateText } from "@/components/preferences-provider";
import { LocalizedOption } from "@/components/localized-fields";
import { SymptomLabelHint } from "@/components/symptom-label-hint";
import { getMedicationSymptomIndex } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { redirect } from "next/navigation";
import { recordSymptomContext, recordLifeImpact } from "@/app/actions";
import { LifeImpactFields } from "@/components/life-impact-fields";
import { LifeImpactSummary } from "@/components/life-impact-summary";
import { CONTEXT_QUESTIONS, CONTEXT_EXPLANATIONS, questionsForGroup } from "@/lib/context-questions";
import { findMedication, findSymptomEvent, isDatabaseConfigured, listCycleCheckins, listCyclePeriods, listSymptomContextAnswers } from "@/lib/db";
import { SYMPTOM_GROUPS, isGroupId, matchSymptomGroup } from "@/lib/symptom-groups";
import { UUID_PATTERN } from "@/lib/validation";
import { PageHeading } from "@/components/page-heading";
import { SaveButton } from "@/components/save-button";
import { SymptomContextGuide } from "@/components/symptom-context-guide";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kontekst objawu | Side Effects Her", robots: { index: false, follow: false } };

type Search = { event?: string; saved?: string; error?: string; created?: string };

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default async function ContextPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  if (!isDatabaseConfigured()) return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Kontekst objawu"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Baza danych nie jest skonfigurowana."}/></p></main>;
  const workspace = await requireWorkspace();
  if (!search.event || !UUID_PATTERN.test(search.event)) return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Kontekst objawu"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Wybierz objaw ze swojej historii."}/></p><Link href="/" className="mt-4 inline-block text-link"><T text={"Wróć do historii"}/></Link></main>;
  const eventId = search.event;
  const event = await findSymptomEvent(workspace, eventId);
  if (!event) return <main className="page-shell"><h1 className="text-3xl font-semibold"><T text={"Kontekst objawu"}/></h1><p className="mt-4 text-muted-foreground"><T text={"Nie znaleziono tej obserwacji w Twoim dzienniku."}/></p><Link href="/" className="mt-4 inline-block text-link"><T text={"Wróć do historii"}/></Link></main>;
  const [medication, periods, checkins, answers] = await Promise.all([
    findMedication(workspace, event.medication_id),
    listCyclePeriods(workspace),
    listCycleCheckins(workspace),
    listSymptomContextAnswers(workspace, eventId),
  ]);
  const labelIndex = await getMedicationSymptomIndex(workspace, event.medication_id);
  const groupId = isGroupId(event.symptom_group_id) ? event.symptom_group_id : matchSymptomGroup(event.symptom);
  const groupName = SYMPTOM_GROUPS.find((group) => group.id === groupId)?.labelPl;
  const questions = questionsForGroup(groupId);
  const checkin = checkins.find((item) => item.observed_on === event.onset_on);
  return <main className="page-shell max-w-3xl">
    <Link href={`/?med=${event.medication_id}`} className="text-sm text-link"><T text={"← Twoje leki"}/></Link>
    <div className="mt-5"><PageHeading eyebrow="Twoja obserwacja" title="Małe pytania." accent="Więcej kontekstu."><p><T text={"Odpowiedzi pomogą zapamiętać okoliczności objawu. Nie diagnozują ani nie wykluczają jego przyczyny."}/></p></PageHeading><div className="rounded-2xl border border-primary/20 bg-secondary/65 p-5"><h2 className="section-title">{event.symptom}</h2><p className="mt-2 text-sm text-muted-foreground"><DateText value={event.onset_on}/><T text={"· nasilenie"}/>{event.severity}/5{medication && ` · zapisane dla ${medication.name}`}</p>{groupName && <p className="mt-2 text-xs leading-6 text-muted-foreground"><T text={"Grupa wyszukiwania:"}/>{groupName}<T text={". To kategoria opisu, nie diagnoza."}/></p>}</div></div>
    {search.error && <p role="alert" className="notice-error mt-6"><T text={search.error}/></p>}
    {search.saved && <p role="status" className="notice-success mt-6"><T text={search.saved === "impact" ? "Wpływ na codzienność zapisany." : "Odpowiedzi zapisane."}/></p>}
    {search.created === "1" && <div className="notice-success mt-6"><p role="status"><T text={"Obserwacja zapisana. Możesz teraz dodać kontekst — to opcjonalne."}/></p><Link href={`/?med=${event.medication_id}`} className="text-link"><T text={"Pomiń pytania i wróć do leków →"}/></Link></div>}
    <div className="mt-6"><SymptomLabelHint symptom={event.symptom} sources={labelIndex.sources} medicationId={event.medication_id} /></div>
    <section className="card mt-6"><LifeImpactSummary impacts={event.life_impacts} note={event.impact_note} /><form action={recordLifeImpact} className="space-y-4"><input type="hidden" name="event_id" value={eventId} /><LifeImpactFields initialImpacts={event.life_impacts} initialNote={event.impact_note} /><SaveButton><T text="Zapisz wpływ na codzienność" /></SaveButton></form></section>
    <section className="card mt-6"><p className="step"><T text={"Tylko to, co wiesz"}/></p><h2 className="section-title"><T text={"Twoje odpowiedzi"}/></h2><p className="section-copy"><T text={"Wybierz tak, nie lub nie jestem pewna. Możesz pozostawić pytanie bez odpowiedzi."}/></p><form action={recordSymptomContext} className="space-y-5"><input type="hidden" name="event_id" value={eventId} />{questions.map((questionId) => <div key={questionId} className="rounded-xl border border-border bg-background px-4 py-4"><label htmlFor={`answer-${questionId}`} className="label"><T text={CONTEXT_QUESTIONS[questionId]}/></label><p className="mb-3 text-xs leading-6 text-muted-foreground"><T text={CONTEXT_EXPLANATIONS[questionId]}/></p><select id={`answer-${questionId}`} name={`answer_${questionId}`} defaultValue={answers.find((item) => item.question_id === questionId)?.answer ?? ""} className="input max-w-xs"><LocalizedOption value="">Bez odpowiedzi</LocalizedOption><LocalizedOption value="yes">Tak</LocalizedOption><LocalizedOption value="no">Nie</LocalizedOption><LocalizedOption value="unsure">Nie jestem pewna</LocalizedOption></select></div>)}<SaveButton><T text={"Zapisz odpowiedzi"}/></SaveButton></form></section>
    <SymptomContextGuide date={event.onset_on} groupId={groupId} periods={periods} checkin={checkin} answers={answers} medicationId={event.medication_id} />
    <p className="mt-7 text-xs leading-5 text-muted-foreground"><T text={"Side Effects Her zachowuje odpowiedzi, ale nie wyklucza na ich podstawie żadnej przyczyny, w tym nawodnienia, cyklu czy działania leku. Utrzymujące się lub niepokojące objawy omów z lekarzem."}/></p>
  </main>;
}
