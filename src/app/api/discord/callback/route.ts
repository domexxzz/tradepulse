import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { connectWithCode, discordOAuthEnabled, verifyState } from "@/lib/discord-oauth";
import { syncDiscordRoles } from "@/lib/discord";
import { getUserSubscription } from "@/lib/subscription";
import type { PlanInterval } from "@/config/plans";

export const dynamic = "force-dynamic";

const base = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const back = (status: string) => NextResponse.redirect(new URL(`/account/discord?discord=${status}`, base()));

/**
 * Discord พาลูกค้ากลับมาที่นี่หลังกดยืนยัน
 *
 * ไม่เชื่อ session ตรงนี้ แต่เชื่อ state ที่เราเซ็นไว้ตอนเริ่ม — ลูกค้าบางคนกลับมา
 * ในเบราว์เซอร์ที่ cookie ไม่ถูกส่งมาด้วย (Discord พากลับแบบ cross-site)
 * state ที่เซ็นด้วย NEXTAUTH_SECRET และหมดอายุ 10 นาที ทำหน้าที่เดียวกันได้อย่างปลอดภัย
 *
 * ทุกทางออกพากลับหน้า /account/discord พร้อมรหัสสถานะ ไม่โชว์ JSON ให้ลูกค้าอ่าน
 */
export async function GET(req: Request) {
  if (!discordOAuthEnabled) return back("disabled");

  const url = new URL(req.url);

  // ลูกค้ากดยกเลิกในหน้าของ Discord
  if (url.searchParams.get("error")) return back("cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("failed");

  const userId = verifyState(state);
  if (!userId) return back("expired");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return back("failed");

  // ให้ยศตั้งแต่ตอนเข้าเซิร์ฟเวอร์เลยถ้ามีแพ็กเกจอยู่ ลูกค้าจะเห็นห้องสมาชิกทันที
  const { sub, isActive } = await getUserSubscription(userId);
  const planCode = isActive && sub ? (sub.planCode as PlanInterval) : null;

  const res = await connectWithCode(code, []);
  if (!res) return back("failed");

  // กันคนอื่นแอบผูก Discord ที่มีเจ้าของแล้ว — เช็คหลังรู้ตัวตนจริงจาก Discord
  const taken = await prisma.user.findFirst({
    where: { discordUserId: res.identity.id, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return back("taken");

  await prisma.user.update({
    where: { id: userId },
    data: { discordUserId: res.identity.id, discordUsername: res.identity.username },
  });

  if (!res.joined) return back("joinfailed");

  if (planCode) {
    const roles = await syncDiscordRoles(res.identity.id, planCode);
    if (!roles.ok) return back("rolefailed");
    return back("linked");
  }

  return back("linked-nosub");
}
