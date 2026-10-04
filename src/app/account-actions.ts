"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { consumeAuthAttempt, createSession, requireAccount, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword, tokenHash, verifyPassword } from "@/lib/password";
import { UUID_PATTERN } from "@/lib/validation";
function failure(message:string):never { redirect(`/login?error=${encodeURIComponent(message)}`); }
export async function authenticate(data:FormData):Promise<void> {
  const email=String(data.get("email")??"").trim().toLowerCase(), password=String(data.get("password")??""), mode=data.get("mode");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length<12 || password.length>128) failure("Sprawdź e-mail i hasło (12–128 znaków). / Check your email and password (12–128 characters).");
  if(!await consumeAuthAttempt(email)) failure("Zbyt wiele prób. Spróbuj za 15 minut. / Too many attempts. Try again in 15 minutes.");
  let accountId:string;
  if(mode==="register") {
    const name=String(data.get("display_name")??"").trim();
    if(!name || name.length>80) failure("Podaj imię (do 80 znaków). / Enter your name (up to 80 characters).");
    const legacy=(await cookies()).get("sideeffecther_workspace")?.value;
    const workspace=process.env.NODE_ENV!=="production" && data.get("import_journal")==="on" && legacy && UUID_PATTERN.test(legacy) ? legacy : randomUUID();
    const hash=await hashPassword(password);
    try {
      accountId=await db().begin(async tx=>{
        // Lock the same legacy journal during a one-time claim; an owned journal is never reassigned.
        await tx`select pg_advisory_xact_lock(hashtext(${workspace}))`;
        const owned=await tx`select 1 from public.accounts where workspace_id=${workspace}`;
        if(owned.length) throw new Error("journal_owned");
        const rows=await tx<{id:string}[]>`insert into public.accounts(workspace_id,email,password_hash,display_name) values(${workspace},${email},${hash},${name}) returning id`;
        return rows[0].id;
      });
    } catch { failure("Nie udało się utworzyć konta. Ten e-mail lub dziennik może już mieć konto. / Could not create account. This email or journal may already have an account."); }
  } else {
    const rows=await db()<{id:string;password_hash:string}[]>`select id,password_hash from public.accounts where email=${email}`;
    // Same work for missing and existing emails.
    const dummy="scrypt:00000000000000000000000000000000:"+"00".repeat(64);
    const valid=await verifyPassword(password,rows[0]?.password_hash??dummy);
    if(!rows[0] || !valid) failure("Niepoprawny e-mail lub hasło. / Incorrect email or password.");
    accountId=rows[0].id;
  }
  await createSession(accountId);
  // An unclaimed old journal is kept for an explicit import instead of silently losing its cookie.
  revalidatePath("/","layout"); redirect("/");
}
export async function signOut():Promise<void> {
  const account=await requireAccount(), jar=await cookies(), token=jar.get(SESSION_COOKIE)?.value;
  if(token) await db()`delete from public.account_sessions where account_id=${account.id} and token_hash=${tokenHash(token)}`;
  // Remove this browser's subscription; never leave a prior account receiving reminders here.
  const endpoint=jar.get("sideeffecther_push_endpoint")?.value;
  if(endpoint) await db()`delete from public.push_subscriptions where account_id=${account.id} and endpoint=${endpoint}`;
  jar.delete(SESSION_COOKIE); jar.delete("sideeffecther_push_endpoint");
  revalidatePath("/","layout"); redirect("/login");
}
export async function savePreferences(data:FormData):Promise<void> {
  const account=await requireAccount();
  const locale=data.get("locale"),theme=data.get("theme"),timezone=String(data.get("timezone")??""),name=String(data.get("display_name")??"").trim();
  let validZone=true;try{new Intl.DateTimeFormat("en",{timeZone:timezone}).format(new Date());}catch{validZone=false;}
  if(!["pl","en"].includes(locale as string)||!["light","dark","system"].includes(theme as string)||!validZone||!name||name.length>80||timezone.length>80) redirect("/settings?error=Invalid%20preferences");
  await db()`update public.accounts set locale=${locale as string},theme=${theme as string},timezone=${timezone},display_name=${name} where id=${account.id}`;
  revalidatePath("/","layout");redirect("/settings?saved=1");
}
export async function changePassword(data:FormData):Promise<void> {
  const account=await requireAccount(), current=String(data.get("current_password")??""),next=String(data.get("new_password")??"");
  if(!await consumeAuthAttempt(account.email)) redirect("/settings?error=Too%20many%20attempts");
  const rows=await db()<{password_hash:string}[]>`select password_hash from public.accounts where id=${account.id}`;
  if(current.length>128||next.length<12||next.length>128||!await verifyPassword(current,rows[0].password_hash))redirect("/settings?error=Check%20passwords%20%2812%E2%80%93128%20characters%29");
  const hash=await hashPassword(next);
  await db().begin(async tx=>{await tx`update public.accounts set password_hash=${hash} where id=${account.id}`;await tx`delete from public.account_sessions where account_id=${account.id}`;});
  await createSession(account.id);redirect("/settings?saved=1");
}
