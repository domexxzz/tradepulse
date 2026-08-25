"use server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { site } from "@/config/site";
import { sendEmail, emailEnabled } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

/** อายุลิงก์รีเซ็ตรหัสผ่าน */
const TOKEN_MINUTES = 60;

/** ขอลิงก์ได้กี่ครั้งต่อชั่วโมง (กันคนสแปมอีเมลใส่คนอื่น) */
const MAX_REQUESTS_PER_HOUR = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type ForgotState = { ok?: boolean; error?: string };
export type ResetState = { ok?: boolean; error?: string };

const emailSchema = z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง");

const passwordSchema = z
  .string()
  .min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร")
  .max(200, "รหัสผ่านยาวเกินไป");

/**
 * ขอลิงก์ตั้งรหัสผ่านใหม่
 *
 * ตอบ "ส่งแล้ว" เสมอไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่ — ถ้าตอบต่างกัน
 * หน้านี้จะกลายเป็นเครื่องมือให้คนไล่เช็คว่าอีเมลไหนเป็นสมาชิกของเรา
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "อีเมลไม่ถูกต้อง" };

  if (!emailEnabled) {
    return { error: "ระบบส่งอีเมลยังไม่เปิดใช้งาน กรุณาติดต่อทีมงานเพื่อรีเซ็ตรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  // ไม่มีบัญชี หรือเป็นบัญชีที่ล็อกอินด้วย Google/LINE (ไม่มีรหัสผ่านให้รีเซ็ต)
  if (!user?.passwordHash || !user.email) return { ok: true };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return { ok: true };

  // ตั๋วเก่าที่ยังไม่ถูกใช้ให้หมดสิทธิ์ทันที — เหลือลิงก์ที่ใช้ได้ครั้งละใบเดียว
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000),
    },
  });

  const mail = passwordResetEmail({
    name: user.name,
    url: `${site.url}/reset-password?token=${token}`,
    minutes: TOKEN_MINUTES,
  });
  await sendEmail({ to: user.email, ...mail });

  return { ok: true };
}

/** ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่" };

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "รหัสผ่านไม่ถูกต้อง" };
  if (password !== confirm) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // ล้างตั๋วที่เหลือของผู้ใช้คนนี้ กันลิงก์เก่าถูกนำมาใช้ภายหลัง
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);

  return { ok: true };
}
