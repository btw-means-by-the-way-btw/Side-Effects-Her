import {NextResponse} from "next/server";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {getAccount} from "@/lib/auth";
import {summaryData} from "@/lib/summary-data";
import {makeSummaryPdf} from "@/lib/summary-pdf";
export const runtime="nodejs";
export async function GET(){const account=await getAccount();if(!account)return NextResponse.json({message:"Sign in"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{const [data,regular,bold]=await Promise.all([summaryData(account),readFile(path.join(process.cwd(),"public/design/fonts/manrope-regular.ttf")),readFile(path.join(process.cwd(),"public/design/fonts/manrope-semibold.ttf"))]);const bytes=await makeSummaryPdf(data,regular,bold);return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Side Effects Her-summary.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}catch{console.error("Summary PDF generation failed");return NextResponse.json({message:"Could not create PDF. Try again later."},{status:503,headers:{"Cache-Control":"no-store"}});}}
