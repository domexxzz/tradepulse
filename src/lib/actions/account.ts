"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncTradingViewGrant } from "@/lib/lifecycle";
import { revokeTradingViewAccess } from "@/lib/tradingview";
import { hasActiveSubscription } from "@/lib/subscription";
import { sendAdminAlert } from "@/lib/telegram";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export type TvState = { ok?: boolean; error?: string };

const tvSchema = z
  .string()
  .min(3, "username สั้นเกินไป")
  .max(40)
  .regex(/^[a-zA-Z0-9_]+$/, "ใช้ได้เฉพาะ a-z, 0-9 และ _");

export async function updateTradingView(
  _prev: TvState,
  formData: FormData
): Promise<TvState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบ" };

  const parsed = tvSchema.safeParse(String(formData.get("tvUsername") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ไม่ถูกต้อง" };

  /**
   * ชื่อเดิม — ต้องอ่านก่อนเขียนทับ เพราะถ้าเคยให้สิทธิ์ชื่อนั้นไปแล้วต้องถอนคืน
   *
   * ของเดิมเขียนทับเฉย ๆ ชื่อที่พิมพ์ผิดจึงค้างอยู่บนสคริปต์ TradingView ตลอดไป
   * แปลว่าบัญชีคนอื่น (ที่บังเอิญชื่อตรงกับที่พิมพ์ผิด) ได้ใช้อินดิเคเตอร์ฟรี
   * และเราก็ไม่มีทางรู้เลยว่าเกิดขึ้นกี่ครั้งแล้ว
   * (30 ก.ย. 69 ลูกค้าแจ้งผ่านมินว่ากรอกผิด ขอเปลี่ยนชื่อใหม่ — เจอรูนี้ตอนไปตรวจ)
   */
  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tradingViewUsername: true },
  });
  const previous = before?.tradingViewUsername ?? null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tradingViewUsername: parsed.data },
  });
  await prisma.accessGrant.updateMany({
    where: { userId: session.user.id, status: "PENDING" },
    data: { tradingViewUsername: parsed.data },
  });

  // เปลี่ยนชื่อ = ถอนของเก่าออกก่อน ไม่งั้นชื่อที่พิมพ์ผิดได้ใช้ฟรีตลอดไป
  // ถอนไม่สำเร็จไม่ควรทำให้การบันทึกล้ม แต่ต้องมีคนรู้ จึงเตือนแอดมินไว้
  const changed = previous !== null && previous !== parsed.data;
  if (changed) {
    try {
      const res = await revokeTradingViewAccess(previous);
      if (!res.ok && !res.skipped) {
        await sendAdminAlert(
          `⚠️ ถอนสิทธิ์ชื่อเก่าไม่สำเร็จ — ชื่อนี้ยังใช้อินดิเคเตอร์ได้อยู่
สมาชิก: ${session.user.email ?? session.user.id}
ชื่อเก่า: ${previous}
ชื่อใหม่: ${parsed.data}
สาเหตุ: ${res.reason ?? "ไม่ทราบ"}
ต้องไปกดลบ ${previous} เองที่ /admin/access-queue`
        ).catch(() => {});
      }
    } catch (e) {
      console.error("revoke previous tv username failed:", e);
    }
  }

  // กรอก username ทีหลังตอนจ่ายเงินไปแล้ว — ให้บอทลองเพิ่มสิทธิ์ทันที ไม่ต้องรอแอดมิน
  const isActive = await hasActiveSubscription(session.user.id);
  if (isActive) {
    await syncTradingViewGrant(session.user.id);
  }

  // แจ้งแอดมินว่ามี username เข้ามาใหม่ ต้องไปเพิ่มสิทธิ์บน TradingView
  // ห้ามให้ขั้นตอนแจ้งเตือนทำให้การบันทึกล้ม จึงกลืน error ไว้
  try {
    const who = session.user.email ?? session.user.id;
    await sendAdminAlert(
      `📝 มี TradingView username เข้ามาใหม่
สมาชิก: ${who}
username: ${parsed.data}
สถานะแพ็กเกจ: ${isActive ? "กำลังใช้งาน" : "ยังไม่มีแพ็กเกจที่ใช้งานอยู่"}
เพิ่มสิทธิ์แล้วกด "ให้สิทธิ์แล้ว" ที่ /admin/access-queue`
    );
  } catch (e) {
    console.error("notify admin (tv username) failed:", e);
  }

  revalidatePath("/account/tradingview");
  return { ok: true };
}
