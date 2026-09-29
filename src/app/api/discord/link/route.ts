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

  // ส่ง callbackUrl แบบเดียวกับที่หน้า /account ใช้ ลูกค้าจะได้กลับมาหน้า Discord
  // เองหลังล็อกอิน ไม่ต้องไล่หาเมนูใหม่
  const session = await auth();
  if (!session?.user?.id) {
    const login = new URL("/login", base);
    login.searchParams.set("callbackUrl", new URL("/account/discord", base).toString());
    return NextResponse.redirect(login);
  }

  if (!discordOAuthEnabled) {
    return NextResponse.redirect(new URL("/account/discord?discord=disabled", base));
  }

  return NextResponse.redirect(authorizeUrl(signState(session.user.id)));
}
