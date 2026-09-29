import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { telegramInviteEmail } from "@/lib/email-templates";
import { ACTIVE_STATUSES, getUserSubscription } from "@/lib/subscription";

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
    // ต้องกรองว่ามีลิงก์จริง ไม่ใช่หยิบแถวล่าสุดมาแล้วค่อยเช็ก
    // สมาชิกคนหนึ่งมีได้หลายแถว (เช่น แถว ADDED จากรอบก่อน + แถว PENDING ใหม่)
    // ถ้าแถวล่าสุดไม่มีลิงก์ จะคืน false ทั้งที่มีแถวอื่นที่ส่งได้
    prisma.telegramGrant.findFirst({
      where: { userId, status: { in: ["PENDING", "ADDED"] }, inviteLink: { not: null } },
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

/**
 * ใครที่ยังไม่ได้ลิงก์ทางอีเมล — แหล่งความจริงแหล่งเดียว
 *
 * ทำไมต้องรวมไว้ที่เดียว: ก่อนหน้านี้หน้าแอดมินกับรอบกวาดเขียน query แยกกัน
 * แล้วถามคนละคำถาม หน้าแอดมินนับ "มีแถว PENDING" ส่วนตัวส่งหยิบ "แถวล่าสุด
 * ที่เป็น PENDING หรือ ADDED" คนที่เข้ากลุ่มไปแล้วจึงถูกนับแต่ส่งไม่ได้
 * หน้าเว็บขึ้น 7 ราย แต่ส่งจริงได้ 0 (เจอจริง 29 ก.ย. 69)
 * ตัวเลขที่ไม่ตรงกับสิ่งที่ระบบทำได้จริง แย่กว่าไม่มีตัวเลขเลย
 *
 * กติกา: สิทธิ์ยังใช้งานได้ + มีแถว PENDING ที่ยังไม่เคยส่ง + ยังไม่ได้อยู่ในกลุ่ม
 * คนที่อยู่ในกลุ่มแล้วไม่ต้องส่งอะไรอีก ต่อให้มีแถว PENDING เก่าค้างอยู่ก็ตาม
 */
export async function usersAwaitingInviteEmail(): Promise<string[]> {
  const active = await prisma.subscription.findMany({
    where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gte: new Date() } },
    select: { userId: true },
    take: 500,
  });
  if (active.length === 0) return [];

  const grants = await prisma.telegramGrant.findMany({
    where: { userId: { in: active.map((s) => s.userId) }, status: { in: ["PENDING", "ADDED"] } },
    select: { userId: true, status: true, notifiedAt: true },
  });

  const inGroup = new Set(grants.filter((g) => g.status === "ADDED").map((g) => g.userId));
  const waiting = new Set(
    grants
      .filter((g) => g.status === "PENDING" && g.notifiedAt === null && !inGroup.has(g.userId))
      .map((g) => g.userId),
  );
  return [...waiting];
}
