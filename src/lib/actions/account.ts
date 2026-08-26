"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncTradingViewGrant } from "@/lib/lifecycle";
import { hasActiveSubscription } from "@/lib/subscription";

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tradingViewUsername: parsed.data },
  });
  await prisma.accessGrant.updateMany({
    where: { userId: session.user.id, status: "PENDING" },
    data: { tradingViewUsername: parsed.data },
  });

  // กรอก username ทีหลังตอนจ่ายเงินไปแล้ว — ให้บอทลองเพิ่มสิทธิ์ทันที ไม่ต้องรอแอดมิน
  if (await hasActiveSubscription(session.user.id)) {
    await syncTradingViewGrant(session.user.id);
  }

  revalidatePath("/account/tradingview");
  return { ok: true };
}
