"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export type AuthState = { error?: string };

/** สมัครสมาชิกได้กี่ครั้งต่อ IP ต่อชั่วโมง — กันสร้างบัญชีปลอมรัว ๆ */
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_IP = 5;

const registerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัวอักษร"),
});

export async function registerUser(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  // กันสร้างบัญชีปลอมรัว ๆ จาก IP เดียว — เช็กก่อนแตะฐานข้อมูล
  const ipKey = `register:ip:${await getClientIp()}`;
  if (await isRateLimited(ipKey, REGISTER_MAX_PER_IP, REGISTER_WINDOW_MS)) {
    return { error: "สมัครบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" };
  }
  await recordAttempt(ipKey, REGISTER_WINDOW_MS);

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "อีเมลนี้ถูกใช้งานแล้ว" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash },
  });

  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirectTo: "/account",
  });
  return {};
}

export async function loginUser(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  // ช่องเดียวรับได้ทั้งอีเมลและชื่อผู้ใช้ — ชื่อฟิลด์ยังเป็น email เพื่อให้เข้ากับ provider เดิม
  const identifier = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  try {
    // แอดมินพาไปหน้าจัดการระบบเลย ไม่ต้องพิมพ์ URL เอง
    // ต้องค้นด้วยเงื่อนไขเดียวกับตอนตรวจรหัสผ่าน ไม่งั้นคนที่ล็อกอินด้วยชื่อผู้ใช้
    // จะหา role ไม่เจอแล้วถูกพาไปหน้าสมาชิกทั้งที่เป็นแอดมิน
    const existing = await prisma.user.findUnique({
      where: identifier.includes("@") ? { email: identifier } : { username: identifier },
      select: { role: true },
    });
    const redirectTo = existing?.role === "ADMIN" ? "/admin" : "/account";
    await signIn("credentials", { email: identifier, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) {
      // แยกกรณีถูกจำกัดจำนวนครั้งออกจาก "รหัสผิด" เพื่อบอกผู้ใช้ให้ถูก
      if ((e as { code?: string }).code === "too_many_requests") {
        return { error: "ลองผิดหลายครั้งเกินไป กรุณารอสัก 5 นาทีแล้วลองใหม่" };
      }
      return { error: "อีเมล ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง" };
    }
    throw e; // redirect
  }
  return {};
}
