"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

export type AuthState = { error?: string };

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
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  try {
    // แอดมินพาไปหน้าจัดการระบบเลย ไม่ต้องพิมพ์ URL เอง
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    const redirectTo = existing?.role === "ADMIN" ? "/admin" : "/account";
    await signIn("credentials", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }
    throw e; // redirect
  }
  return {};
}
