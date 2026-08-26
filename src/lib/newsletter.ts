import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { site } from "@/config/site";

/**
 * โทเคนยกเลิกรับข่าวสาร — ให้กดจากลิงก์ในอีเมลได้โดยไม่ต้องล็อกอิน
 * เก็บในฐานข้อมูลแทนการเซ็นด้วย secret เพื่อให้เพิกถอนทีละรายได้
 * และไม่ทำให้ลิงก์เก่าตายยกชุดเวลาเปลี่ยน secret
 */
export async function ensureUnsubscribeToken(subscriberId: string, existing: string | null) {
  if (existing) return existing;
  const token = randomUUID();
  await prisma.subscriber.update({ where: { id: subscriberId }, data: { unsubscribeToken: token } });
  return token;
}

export function unsubscribeUrl(token: string) {
  return `${site.url}/unsubscribe?token=${encodeURIComponent(token)}`;
}
