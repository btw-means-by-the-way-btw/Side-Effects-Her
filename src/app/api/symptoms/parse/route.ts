import { NextRequest, NextResponse } from "next/server";
import { findMedication, hasBaseline } from "@/lib/db";
import { createOpenAiSymptomExtractor } from "@/lib/symptom-draft/openai";
import { UUID_PATTERN } from "@/lib/validation";
import { getAccount } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: "Request origin is not allowed." }, { status: 403, headers });
  const account = await getAccount(), workspace = account?.workspace_id;
  if (!workspace) return NextResponse.json({ message: "Sign in to continue." }, { status: 401, headers });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ message: "AI symptom entry is not configured. Use the manual form." }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > 8_000) return NextResponse.json({ message: "Description is too long." }, { status: 413, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ message: "Invalid request." }, { status: 400, headers });
  const { medicationId, statement } = body as Record<string, unknown>;
  if (typeof medicationId !== "string" || !UUID_PATTERN.test(medicationId) || typeof statement !== "string" || !statement.trim() || statement.length > 2000) {
    return NextResponse.json({ message: "Enter a description of up to 2,000 characters." }, { status: 400, headers });
  }
  try {
    const medication = await findMedication(workspace, medicationId);
    if (!medication || !(await hasBaseline(workspace, medicationId))) return NextResponse.json({ message: "Save a baseline for this medication first." }, { status: 403, headers });
  } catch {
    return NextResponse.json({ message: "Your records are temporarily unavailable." }, { status: 503, headers });
  }
  // Only the user-written statement is sent to the LLM. Medication, timeline, and openFDA data stay here.
  const extract = createOpenAiSymptomExtractor({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_SYMPTOM_MODEL });
  const result = await extract(statement);
  if (result.status !== "ok") return NextResponse.json({ message: result.message }, { status: result.status === "unavailable" ? 503 : 422, headers });
  return NextResponse.json({ candidates: result.candidates }, { headers });
}
