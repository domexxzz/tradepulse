"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendEmail, emailEnabled } from "@/lib/email";
import { newsletterEmail } from "@/lib/email-templates";
import { ensureUnsubscribeToken, unsubscribeUrl } from "@/lib/newsletter";

export type BroadcastState = { ok?: boolean; error?: string; sent?: number; failed?: number };

/** กันยิงพลาดเป็นพัน — เกินนี้ควรใช้เครื่องมือส่งอีเมลจริง */
const MAX_RECIPIENTS = 500;

const schema = z.object({
  subject: z.string().trim().min(5, "หัวข้ออย่างน้อย 5 ตัวอักษร").max(150),
  body: z.string().trim().min(20, "เนื้อหาอย่างน้อย 20 ตัวอักษร").max(5000),
  confirm: z.literal("SEND", { message: "พิมพ์ SEND ในช่องยืนยันก่อนส่ง" }),
});

/**
 * ส่งข่าวสารถึงผู้ที่ยังไม่ได้ยกเลิก
 * ส่งทีละคนเพราะลิงก์ยกเลิกของแต่ละคนไม่เหมือนกัน
 */
export async function sendBroadcast(
  _prev: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  await requireAdmin();

  if (!emailEnabled) {
    return { error: "ยังไม่ได้ตั้งค่าระบบอีเมล (RESEND_API_KEY และ EMAIL_FROM)" };
  }

  const parsed = schema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const recipients = await prisma.subscriber.findMany({
    where: { unsubscribedAt: null },
    select: { id: true, email: true, unsubscribeToken: true },
    orderBy: { createdAt: "asc" },
    take: MAX_RECIPIENTS,
  });

  if (recipients.length === 0) return { error: "ยังไม่มีผู้รับข่าวสาร" };

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const token = await ensureUnsubscribeToken(r.id, r.unsubscribeToken);
    const url = unsubscribeUrl(token);
    const mail = newsletterEmail({ subject: parsed.data.subject, body: parsed.data.body, unsubscribeUrl: url });

    const res = await sendEmail({
      to: r.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      // ให้ปุ่ม "ยกเลิกรับข่าวสาร" ของโปรแกรมอีเมลใช้งานได้ ช่วยไม่ให้ถูกมองว่าเป็นสแปม
      headers: { "List-Unsubscribe": `<${url}>` },
    });

    if (res.ok) sent++;
    else failed++;
  }

  revalidatePath("/admin/newsletter");
  return { ok: true, sent, failed };
}

export type UnsubState = { ok?: boolean; error?: string };

/**
 * ยกเลิกรับข่าวสารจากลิงก์ในอีเมล — ไม่ต้องล็อกอิน ตัวโทเคนคือหลักฐานสิทธิ์
 * เรียกจากปุ่มยืนยัน (POST) ไม่ใช่ตอนเปิดลิงก์ เพราะตัวสแกนอีเมลชอบกดลิงก์เอง
 * ถ้ายกเลิกตอน GET คนจะหลุดจากรายชื่อทั้งที่ไม่ได้ตั้งใจ
 */
export async function unsubscribeByToken(
  _prev: UnsubState,
  formData: FormData
): Promise<UnsubState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "ลิงก์ไม่ถูกต้อง" };

  const sub = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, unsubscribedAt: true },
  });
  if (!sub) return { error: "ลิงก์นี้ใช้ไม่ได้แล้ว หากต้องการยกเลิกกรุณาติดต่อทีมงาน" };

  if (!sub.unsubscribedAt) {
    await prisma.subscriber.update({
      where: { id: sub.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  revalidatePath("/admin/subscribers");
  return { ok: true };
}
