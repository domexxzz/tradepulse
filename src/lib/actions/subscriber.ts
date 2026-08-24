"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type SubscribeState = { ok?: boolean; error?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง").max(200),
  consent: z.literal("on", { message: "กรุณาติ๊กยอมรับก่อนสมัครรับข่าวสาร" }),
});

/**
 * เก็บอีเมลผู้สนใจที่ยังไม่ซื้อ
 * - ต้องติ๊กยินยอมก่อน (ฐานความยินยอมตาม PDPA)
 * - มี honeypot กันบอทกรอกอัตโนมัติ
 * - อีเมลซ้ำถือว่าสำเร็จ ไม่ต้องแจ้ง error ให้ผู้ใช้สับสน
 */
export async function subscribeEmail(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  // honeypot: ช่องนี้ซ่อนจากคนจริง ถ้ามีค่าแปลว่าเป็นบอท
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { ok: true };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const email = parsed.data.email;
  const source = String(formData.get("source") ?? "landing").slice(0, 40);

  try {
    await prisma.subscriber.upsert({
      where: { email },
      // เคยกดยกเลิกไว้แล้วสมัครใหม่ ให้กลับมารับข่าวสารอีกครั้ง
      update: { unsubscribedAt: null },
      create: { email, source },
    });
  } catch {
    return { error: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งครับ" };
  }

  return { ok: true };
}
