import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";

/**
 * Edge-safe config (ใช้ใน middleware) — ห้ามใส่ Prisma/bcrypt ตรงนี้
 * เพิ่ม OAuth provider เฉพาะเมื่อมีคีย์ใน env
 */
const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_LINE_ID) providers.push(Line);

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  providers,
  callbacks: {
    authorized({ auth }) {
      // matcher จำกัดเฉพาะ /account, /admin อยู่แล้ว — แค่เช็คว่าล็อกอิน
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
