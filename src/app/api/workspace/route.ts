import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/auth";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(await getAccount() ? "/" : "/login", request.url));
}
