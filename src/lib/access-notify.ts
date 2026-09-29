import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { accessGrantedEmail } from "@/lib/email-templates";
import { ensureTelegramInvite } from "@/lib/lifecycle";
import { getUserSubscription } from "@/lib/subscription";
import { markTelegramInviteNotified } from "@/lib/telegram-invite";
import { discordOAuthEnabled } from "@/lib/discord-oauth";
import { site } from "@/config/site";

/**
 * แจ้งลูกค้าว่าเพิ่มอินดิเคเตอร์ให้แล้ว พร้อมลิงก์เชิญกลุ่ม Telegram
 *
 * แยกออกมาจาก lib/actions/admin.ts เพราะไฟล์นั้นเป็น "use server"
 * ทุก export ในนั้นกลายเป็น server action ที่เรียกจากเบราว์เซอร์ได้
 * ซึ่งไม่ควรเป็นแบบนั้นสำหรับฟังก์ชันที่ส่งอีเมลหาลูกค้า
 *
 * เรียกจากสองที่:
 *   - แอดมินกดปุ่ม "อนุมัติ" ในคิวสิทธิ์ (กรณีไปจัดการบน TradingView เองแล้ว)
 *   - callback ตอนบอทเพิ่มสำเร็จ  ← ทางปกติ
 *
 * ก่อนหน้านี้เรียกจากที่แรกที่เดียว ตอนบอททำสำเร็จเองจึงไม่มีใครบอกลูกค้า
 * ลิงก์เชิญ Telegram เลยค้างอยู่ในหน้าบัญชีโดยที่ลูกค้าไม่รู้ว่ามี
 * (เห็นได้จากสถานะ "ส่งลิงก์แล้ว ยังไม่ได้กดเข้า" ที่ค้างอยู่หลายราย)
 */
export async function notifyAccessGranted(userId: string, tvUsername: string | null): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, tradingViewUsername: true },
  });
  if (!user?.email) return;

  // มีแพ็กเกจใช้งานอยู่ถึงจะมีสิทธิ์เข้ากลุ่ม — สร้างลิงก์เชิญให้ถ้ายังไม่มี
  const { sub, isActive } = await getUserSubscription(userId);
  if (isActive) await ensureTelegramInvite(userId);

  const tg = await prisma.telegramGrant.findFirst({
    where: { userId, status: { in: ["PENDING", "ADDED"] } },
    orderBy: { createdAt: "desc" },
    select: { inviteLink: true },
  });

  const mail = accessGrantedEmail({
    name: user.name,
    tvUsername: tvUsername ?? user.tradingViewUsername ?? "-",
    until: isActive ? sub?.currentPeriodEnd ?? null : null,
    telegramInviteUrl: tg?.inviteLink ?? null,
    // ชวนไปรับยศ Discord เฉพาะตอนที่ระบบเปิดอยู่จริง
    // ไม่งั้นลูกค้าจะกดไปเจอหน้าที่ยังใช้ไม่ได้ แล้วต้องทักมาถาม
    discordUrl: discordOAuthEnabled && isActive ? `${site.url}/account/discord` : null,
  });
  const res = await sendEmail({ to: user.email, ...mail });

  // อีเมลฉบับนี้แนบลิงก์กลุ่มไปด้วยแล้ว — ประทับไว้ไม่ให้รอบกวาดรายวันส่งซ้ำอีกฉบับ
  if (res.ok && tg?.inviteLink) await markTelegramInviteNotified(userId);
}
