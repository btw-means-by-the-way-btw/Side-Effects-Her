import { T } from "@/components/preferences-provider";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {getAccount} from "@/lib/auth";
import {AuthForm} from "@/components/auth-form";
import {PageHeading} from "@/components/page-heading";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if(await getAccount())redirect("/");const search=await searchParams;
  return <main className="page-shell auth-layout"><div><PageHeading eyebrow="Osobisty dziennik" title="Twoja przestrzeń." accent="Twoja historia."/><p className="section-copy"><T text={"Leki, cykl i obserwacje przypisane do Twojego konta. Wróć do nich także na innym urządzeniu."}/></p><div className="auth-art"><img src="/design/assets/medication-sculpture.png" alt=""/></div></div><section className="card">{search.error&&<p role="alert" className="notice-error mb-5"><T text={search.error}/></p>}<AuthForm hasJournal={process.env.NODE_ENV!=="production"&&Boolean((await cookies()).get("sideeffecther_workspace"))}/></section></main>;
}
