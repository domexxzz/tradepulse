import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { telegramInviteEmail } from "@/lib/email-templates";
import { getUserSubscription } from "@/lib/subscription";

/**
 * ส่งลิงก์เข้ากลุ่ม Telegram ให้สมาชิกทางอีเมล
 *
 * แยกมาไว้ไฟล์เดียวเพราะมีสามที่ต้องใช้ และห้ามให้เกิด import วนกัน
 * (lifecycle -> ที่นี่ ได้ แต่ที่นี่ต้องไม่ import lifecycle)
 *   - แอดมินกดปุ่ม "ส่งลิงก์ทางอีเมล" ในหน้า /admin/telegram
 *   - รอบกวาดรายวันใน runMembershipMaintenance (ตัวซ่อมตัวเอง)
 *
 * ไม่สร้างลิงก์ใหม่เอง — ลิงก์เชิญใช้ได้ครั้งเดียว ออกใหม่ทุกครั้งที่ส่ง
 * จะทำให้ลิงก์เก่าที่ส่งไปแล้วใช้ไม่ได้ ให้ ensureTelegramInvite เป็นคนสร้าง
 *
 * ประทับ notifiedAt ไว้เพื่อให้รอบกวาดรู้ว่าคนนี้ได้ลิงก์ไปแล้ว
 * ถ้าไม่ประทับ cron จะยิงอีเมลซ้ำให้คนเดิมทุกวันจนลูกค้ากดสแปม
 */
export async function sendTelegramInviteEmail(userId: string): Promise<boolean> {
  const [user, grant] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.telegramGrant.findFirst({
      where: { userId, status: { in: ["PENDING", "ADDED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, inviteLink: true },
    }),
  ]);
  if (!user?.email || !grant?.inviteLink) return false;

  const { sub, isActive } = await getUserSubscription(userId);
  const mail = telegramInviteEmail({
    name: user.name,
    inviteUrl: grant.inviteLink,
    until: isActive ? sub?.currentPeriodEnd ?? null : null,
  });

  const res = await sendEmail({ to: user.email, ...mail });
  // ส่งไม่ออก (ยังไม่ตั้งค่าอีเมล / SMTP ล่ม) — อย่าประทับว่าส่งแล้ว
  // รอบกวาดวันถัดไปจะได้ลองใหม่เอง
  if (!res.ok) return false;

  await markTelegramInviteNotified(userId, grant.id);
  return true;
}

/**
 * ประทับว่าส่งลิงก์ไปแล้ว — ใช้ตอนลิงก์ไปกับอีเมลฉบับอื่นด้วย
 * (อีเมล "เพิ่มอินดิเคเตอร์ให้แล้ว" และใบเสร็จ ก็แนบลิงก์เดียวกันไป)
 * ถ้าไม่ประทับตรงนั้น รอบกวาดจะส่งอีเมลลิงก์ซ้ำอีกฉบับให้คนที่เพิ่งได้ไป
 */
export async function markTelegramInviteNotified(userId: string, grantId?: string): Promise<void> {
  const id =
    grantId ??
    (
      await prisma.telegramGrant.findFirst({
        where: { userId, status: { in: ["PENDING", "ADDED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )?.id;
  if (!id) return;

  await prisma.telegramGrant.update({ where: { id }, data: { notifiedAt: new Date() } });
}
