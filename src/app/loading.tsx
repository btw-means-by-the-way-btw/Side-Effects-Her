import { T } from "@/components/preferences-provider";
import { PageHeading } from "@/components/page-heading";
export default function Loading() { return <main className="page-shell" aria-busy="true"><PageHeading eyebrow="Twój dziennik" title="Jeszcze chwila." accent="Układamy Twoją historię." /><div className="grid gap-5 md:grid-cols-2"><div className="loading-surface h-80 rounded-[28px]" /><div className="loading-surface h-56 rounded-[24px]" /></div><p role="status" className="mt-5 text-sm text-muted-foreground"><T text="Wczytuję zapisy i dostępne informacje…"/></p></main>; }

