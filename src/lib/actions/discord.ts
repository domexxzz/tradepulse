"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findGuildMember, syncDiscordRoles, revokeDiscordRoles, discordBotEnabled } from "@/lib/discord";
import { getUserSubscription } from "@/lib/subscription";
import type { PlanInterval } from "@/config/plans";

export type DiscordLinkState = { ok?: boolean; error?: string; note?: string };

/**
 * ผูกบัญชี Discord ของสมาชิก
 * รับได้ทั้งชื่อผู้ใช้และ user ID แล้วยืนยันกับเซิร์ฟเวอร์จริงก่อนบันทึก
 * ถ้าสมาชิกมีแพ็กเกจใช้งานอยู่ จะให้ยศทันทีในขั้นตอนเดียว
 */
export async function linkDiscord(
  _prev: DiscordLinkState,
  formData: FormData
): Promise<DiscordLinkState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบ" };

  if (!discordBotEnabled) {
    return { error: "ระบบ Discord ยังไม่เปิดใช้งาน กรุณาติดต่อทีมงาน" };
  }

  const query = String(formData.get("discord") ?? "").trim();
  if (!query) return { error: "กรอกชื่อผู้ใช้ Discord ของคุณ" };

  const member = await findGuildMember(query);
  if (!member) {
    return {
      error: "ไม่พบชื่อนี้ในเซิร์ฟเวอร์ — กรุณาเข้าร่วม Discord ก่อน แล้วกรอกชื่อผู้ใช้ให้ตรง",
    };
  }

  // กันคนอื่นแอบผูก Discord ที่มีเจ้าของแล้ว
  const taken = await prisma.user.findFirst({
    where: { discordUserId: member.id, NOT: { id: session.user.id } },
    select: { id: true },
  });
  if (taken) return { error: "บัญชี Discord นี้ถูกผูกกับสมาชิกรายอื่นแล้ว" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordUserId: member.id, discordUsername: member.username },
  });

  // มีแพ็กเกจอยู่แล้วให้ยศเลย ไม่ต้องรอรอบถัดไป
  let note: string | undefined;
  const { sub, isActive } = await getUserSubscription(session.user.id);
  if (isActive && sub) {
    const res = await syncDiscordRoles(member.id, sub.planCode as PlanInterval);
    note = res.ok
      ? "ให้ยศในเซิร์ฟเวอร์เรียบร้อยแล้ว"
      : `ผูกบัญชีแล้ว แต่ยังให้ยศไม่ได้ (${res.reason}) ทีมงานจะตรวจสอบให้`;
  } else {
    note = "ผูกบัญชีแล้ว จะได้รับยศอัตโนมัติเมื่อแพ็กเกจเริ่มใช้งาน";
  }

  revalidatePath("/account/discord");
  return { ok: true, note };
}

/** ยกเลิกการผูก และถอนยศออกจากเซิร์ฟเวอร์ */
export async function unlinkDiscord(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordUserId: true },
  });

  if (user?.discordUserId) {
    try {
      await revokeDiscordRoles(user.discordUserId);
    } catch {
      // ถอนยศไม่สำเร็จก็ยังต้องยกเลิกการผูกให้ผู้ใช้ได้
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordUserId: null, discordUsername: null },
  });

  revalidatePath("/account/discord");
}
