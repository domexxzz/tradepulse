import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeUrl, discordOAuthEnabled, signState } from "@/lib/discord-oauth";

export const dynamic = "force-dynamic";

/**
 * เริ่มขั้นตอนเชื่อมต่อ Discord — พาลูกค้าไปหน้ายืนยันสิทธิ์ของ Discord
 *
 * ผูก state กับบัญชีที่ล็อกอินอยู่ ไม่เก็บใน cookie เพราะ Discord พากลับมา
 * แบบ cross-site ซึ่ง cookie แบบ SameSite=Lax บางเบราว์เซอร์ไม่ส่งมาให้
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // หน้าเข้าสู่ระบบยังไม่รับพารามิเตอร์ว่าให้กลับมาที่ไหน จึงไม่ใส่ไปให้เปล่า ๆ
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", base));

  if (!discordOAuthEnabled) {
    return NextResponse.redirect(new URL("/account/discord?discord=disabled", base));
  }

  return NextResponse.redirect(authorizeUrl(signState(session.user.id)));
}
