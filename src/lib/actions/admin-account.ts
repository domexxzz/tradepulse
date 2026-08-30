"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

/**
 * จัดการบัญชีของแอดมินเอง — เปลี่ยนรหัสผ่านและผูกอีเมล
 *
 * แยกจาก admin.ts เพราะไฟล์นั้นเป็นเรื่อง "จัดการสมาชิกคนอื่น" คนละโดเมนกัน
 *
 * ทุก action แก้ได้เฉพาะบัญชีของคนที่ล็อกอินอยู่ (ยึด id จาก session)
 * ไม่รับ userId จากฟอร์ม — ไม่งั้นแอดมินคนหนึ่งเปลี่ยนรหัสของอีกคนได้
 */

export interface AccountState {
  error?: string;
  ok?: string;
}

const MIN_PASSWORD = 8;

/**
 * เปลี่ยนรหัสผ่าน — ต้องยืนยันรหัสเดิมก่อนเสมอ
 *
 * เหตุผลที่ต้องถามรหัสเดิมทั้งที่ล็อกอินอยู่แล้ว: ถ้ามีคนมาเจอเครื่องที่เปิดค้างไว้
 * จะได้เปลี่ยนรหัสยึดบัญชีไปเลยไม่ได้
 */
export async function changeAdminPassword(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const session = await requireAdmin();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next) return { error: "กรอกรหัสผ่านให้ครบ" };
  if (next.length < MIN_PASSWORD) return { error: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` };
  if (next !== confirm) return { error: "รหัสผ่านใหม่กับการยืนยันไม่ตรงกัน" };
  if (next === current) return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  // บัญชีที่สมัครผ่าน Google/LINE จะไม่มีรหัสผ่าน ตั้งใหม่ทางนี้ไม่ได้
  if (!user?.passwordHash) {
    return { error: "บัญชีนี้ยังไม่มีรหัสผ่าน (เข้าผ่านบัญชีภายนอก) จึงเปลี่ยนทางนี้ไม่ได้" };
  }

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "รหัสผ่านเดิมไม่ถูกต้อง" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  revalidatePath("/admin/settings");
  return { ok: "เปลี่ยนรหัสผ่านแล้ว ครั้งต่อไปให้ใช้รหัสใหม่" };
}

const emailSchema = z.string().email("รูปแบบอีเมลไม่ถูกต้อง").max(200);

/**
 * ผูก/เปลี่ยนอีเมลของบัญชีตัวเอง
 *
 * ต้องยืนยันรหัสผ่านด้วย เพราะอีเมลคือช่องทางกู้บัญชี — ถ้าเปลี่ยนได้ลอย ๆ
 * คนที่มาเจอเครื่องเปิดค้างจะเปลี่ยนอีเมลแล้วกดลืมรหัสผ่านยึดบัญชีไปได้เลย
 */
export async function changeAdminEmail(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const session = await requireAdmin();

  const raw = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "อีเมลไม่ถูกต้อง" };
  if (!password) return { error: "กรอกรหัสผ่านเพื่อยืนยันตัวตน" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });
  if (!user?.passwordHash) {
    return { error: "บัญชีนี้ยังไม่มีรหัสผ่าน จึงยืนยันตัวตนเพื่อเปลี่ยนอีเมลไม่ได้" };
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  if (user.email === raw) return { ok: "อีเมลนี้ผูกไว้อยู่แล้ว" };

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { email: raw } });
  } catch (e) {
    // P2002 = ชนกับ unique — แปลว่ามีบัญชีอื่นใช้อีเมลนี้อยู่
    // ต้องบอกให้ชัด ไม่งั้นผู้ใช้จะเห็นแค่ error ดิบ ๆ แล้วไม่รู้ว่าต้องทำอะไรต่อ
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return { error: "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว — เข้าด้วยบัญชีนั้นแทน หรือใช้อีเมลอื่น" };
    }
    throw e;
  }

  revalidatePath("/admin/settings");
  return { ok: `ผูกอีเมล ${raw} แล้ว — ใช้กู้รหัสผ่านและล็อกอินได้` };
}
