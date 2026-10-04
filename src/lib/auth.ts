import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db, isDatabaseConfigured } from "./db";
import { tokenHash } from "./password";
export interface Account { id: string; workspace_id: string; email: string; display_name: string; locale: "pl" | "en"; theme: "light" | "dark" | "system"; timezone: string }
export const SESSION_COOKIE = "sideeffecther_session";
export const getAccount = cache(async (): Promise<Account | null> => {
  if (!isDatabaseConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db()<Account[]>`select a.id,a.workspace_id,a.email,a.display_name,a.locale,a.theme,a.timezone from public.accounts a
    join public.account_sessions s on s.account_id=a.id where s.token_hash=${tokenHash(token)} and s.expires_at > now()`;
  return rows[0] ?? null;
});
export async function requireAccount(): Promise<Account> { const account = await getAccount(); if (!account) redirect("/login"); return account; }
export async function requireWorkspace(): Promise<string> { return (await requireAccount()).workspace_id; }
export async function createSession(accountId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db()`insert into public.account_sessions(token_hash,account_id,expires_at) values(${tokenHash(token)},${accountId},now()+interval '7 days')`;
  (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV === "production",path:"/",maxAge:604800});
}
export async function consumeAuthAttempt(email: string): Promise<boolean> {
  const key = tokenHash(email.toLowerCase());
  const rows = await db()<{attempts:number}[]>`insert into public.auth_attempts(key,attempts,reset_at) values(${key},1,now()+interval '15 minutes')
    on conflict(key) do update set attempts=case when auth_attempts.reset_at<now() then 1 else auth_attempts.attempts+1 end,
      reset_at=case when auth_attempts.reset_at<now() then now()+interval '15 minutes' else auth_attempts.reset_at end returning attempts`;
  return rows[0].attempts <= 10;
}
