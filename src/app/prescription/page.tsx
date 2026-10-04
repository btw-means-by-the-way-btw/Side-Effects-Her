import {T} from "@/components/preferences-provider";
import {requireAccount} from "@/lib/auth";
import {PageHeading} from "@/components/page-heading";
import {PrescriptionScanner} from "@/components/prescription-scanner";
export default async function Prescription({searchParams}:{searchParams:Promise<{error?:string}>}){await requireAccount();const search=await searchParams;return <main className="page-shell max-w-4xl"><PageHeading eyebrow="Skanuj receptę" title="Ze zdjęcia do szkicu." accent="Z Twoim potwierdzeniem."/>{search.error&&<p role="alert" className="notice-error mb-5"><T text={search.error}/></p>}<PrescriptionScanner/></main>;}
