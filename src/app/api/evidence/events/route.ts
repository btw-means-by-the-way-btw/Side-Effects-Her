import { NextResponse, type NextRequest } from "next/server";
import { parseMedicationName } from "@/lib/evidence/openfda";
import { openFdaSource } from "@/lib/evidence/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const medicationName = parseMedicationName(request.nextUrl.searchParams.get("medication"));
  if (!medicationName) {
    return NextResponse.json(
      { status: "invalid_request", message: "Provide a medication name of 1–120 letters, numbers, spaces, or basic name punctuation." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const result = await openFdaSource().lookupEvents(medicationName);
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : result.status === "not_found" ? 404 : result.status === "invalid_request" ? 400 : 503,
    headers: { "Cache-Control": "private, no-store" },
  });
}
