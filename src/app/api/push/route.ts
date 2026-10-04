import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
import {getAccount} from "@/lib/auth";
import {db} from "@/lib/db";
import {validPushSubscription} from "@/lib/push-validation";
const headers={"Cache-Control":"no-store"};
export async function GET() {
 const account=await getAccount();if(!account)return NextResponse.json({message:"Sign in"},{status:401,headers});
 const endpoint=(await cookies()).get("sideeffecther_push_endpoint")?.value;
 const rows=endpoint?await db()`select 1 from public.push_subscriptions where endpoint=${endpoint} and account_id=${account.id}`:[];
 return NextResponse.json({publicKey:process.env.VAPID_PUBLIC_KEY??null,subscribed:Boolean(rows.length)},{headers});
}
export async function POST(request:NextRequest) {
 if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({message:"Origin not allowed"},{status:403,headers});
 const account=await getAccount();if(!account)return NextResponse.json({message:"Sign in"},{status:401,headers});
 if(Number(request.headers.get("content-length"))>5000)return NextResponse.json({message:"Too large"},{status:413,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({message:"Invalid request"},{status:400,headers});}
 if(!validPushSubscription(body)||!process.env.VAPID_PUBLIC_KEY)return NextResponse.json({message:"Invalid subscription or push unavailable"},{status:400,headers});
 // A browser may change accounts; this explicit opt-in moves only this endpoint to its new owner.
 await db()`insert into public.push_subscriptions(endpoint,account_id,subscription) values(${body.endpoint},${account.id},${db().json(body)}) on conflict(endpoint) do update set account_id=excluded.account_id,subscription=excluded.subscription`;
 (await cookies()).set("sideeffecther_push_endpoint",body.endpoint,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:604800});
 return NextResponse.json({ok:true},{headers});
}
export async function DELETE(request:NextRequest) {
 if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({message:"Origin not allowed"},{status:403,headers});
 const account=await getAccount();if(!account)return NextResponse.json({message:"Sign in"},{status:401,headers});
 const jar=await cookies(),endpoint=jar.get("sideeffecther_push_endpoint")?.value;
 if(endpoint)await db()`delete from public.push_subscriptions where endpoint=${endpoint} and account_id=${account.id}`;
 jar.delete("sideeffecther_push_endpoint");return NextResponse.json({ok:true},{headers});
}
