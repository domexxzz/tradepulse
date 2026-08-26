import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { resolveRole } from "@/lib/admin-bootstrap";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // ดึง role จาก DB ตอน sign-in (รันฝั่ง Node — prisma ใช้ได้)
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;

      // อ่าน role จากฐานข้อมูลใหม่ทุกครั้ง ไม่ใช่เฉพาะตอน role ว่าง
      // ของเดิมถ้า token มี role ติดอยู่แล้วจะไม่อ่านซ้ำเลยตลอดอายุ token (30 วัน)
      // แปลว่าเลื่อนขั้น/ถอนสิทธิ์ในฐานข้อมูลแล้วไม่มีผลจนกว่า token จะหมดอายุ
      if (token.id) token.role = await resolveRole(token.id as string);

      return token;
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});
