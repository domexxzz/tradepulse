import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";
import { oauthKeys } from "@/lib/oauth-env";

/**
 * Edge-safe config (ใช้ใน middleware) — ห้ามใส่ Prisma/bcrypt ตรงนี้
 * เพิ่ม OAuth provider เฉพาะเมื่อมีคีย์ครบคู่ · ชื่อ env ที่รับได้ดู `@/lib/oauth-env`
 */
const googleKeys = oauthKeys("GOOGLE");
const lineKeys = oauthKeys("LINE");

const providers: NextAuthConfig["providers"] = [];
if (googleKeys) providers.push(Google(googleKeys));
if (lineKeys) providers.push(Line(lineKeys));

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
