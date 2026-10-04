import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { findMedication } from "@/lib/db";
import { openFdaSource } from "@/lib/evidence/server";
import { translateSourceTopics } from "@/lib/label-translation/server";
import { parseLabelTranslationRequest, sourceTranslationTopics } from "@/lib/label-translation/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store" };
const globalLimits = globalThis as typeof globalThis & { labelTranslationLimits?: Map<string, { count: number; expires: number }> };

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ status: "invalid_request" }, { status: 403, headers });
  const account = await getAccount();
  if (!account) return NextResponse.json({ status: "unauthorized" }, { status: 401, headers });
  let body: unknown;
  try { const text = await request.text(); if (text.length > 2000) throw Error(); body = JSON.parse(text); }
  catch { return NextResponse.json({ status: "invalid_request" }, { status: 400, headers }); }
  const input = parseLabelTranslationRequest(body);
  if (!input) return NextResponse.json({ status: "invalid_request" }, { status: 400, headers });
  const { medicationId, labelId, section, paragraphIndex } = input;
  globalLimits.labelTranslationLimits ??= new Map();
  const limits = globalLimits.labelTranslationLimits, time = Date.now(), previous = limits.get(account.id);
  if (previous && previous.expires > time && previous.count >= 40) return NextResponse.json({ status: "unavailable", reason: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(Math.ceil((previous.expires - time) / 1000)) } });
  limits.set(account.id, previous && previous.expires > time ? { ...previous, count: previous.count + 1 } : { count: 1, expires: time + 60 * 60_000 });
  if (limits.size > 1000) for (const [key, entry] of limits) if (entry.expires <= time) limits.delete(key);
  try {
    const medication = await findMedication(account.workspace_id, medicationId);
    if (!medication) return NextResponse.json({ status: "not_found" }, { status: 404, headers });
    // Ignore arbitrary client text. Only public source paragraphs from this medication lookup are translated.
    const lookup = await openFdaSource().lookupLabels(medication.name);
    if (lookup.status !== "ok") return NextResponse.json({ status: "unavailable", reason: "source_unavailable" }, { status: 503, headers });
    const label = lookup.data.labels.find(item => item.id === labelId);
    if (!label) return NextResponse.json({ status: "not_found" }, { status: 404, headers });
    const topics = sourceTranslationTopics(label, input);
    if (!topics.length) return NextResponse.json({ status: "not_found" }, { status: 404, headers });
    const result = await translateSourceTopics(topics);
    return NextResponse.json({ ...result, labelId, section, ...(paragraphIndex !== undefined ? { paragraphIndex } : {}) }, { status: result.status === "ok" ? 200 : 503, headers });
  } catch { return NextResponse.json({ status: "unavailable" }, { status: 503, headers }); }
}
