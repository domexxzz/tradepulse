import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { resolveRole } from "@/lib/admin-bootstrap";

/**
 * hash หลอกสำหรับกรณีไม่เจอผู้ใช้ — ให้เวลาตอบกลับใกล้เคียงกับตอนเจอ
 * ถ้าไม่ทำ ผู้ไม่ประสงค์ดีจะจับเวลาแยกได้ว่า "ชื่อนี้มีอยู่จริงแต่รหัสผิด"
 * ต่างจาก "ไม่มีชื่อนี้" ซึ่งเป็นข้อมูลที่ไม่ควรให้รู้
 * (ค่านี้เป็น bcrypt ของสตริงสุ่ม ไม่ใช่รหัสผ่านของใคร)
 */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.5cVJ5nQ0zJ3ZoQZ1qYJ4Kk8bXk2W";

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
        // ชื่อฟิลด์ยังเป็น email เพื่อไม่ให้ session/ฟอร์มเดิมพัง แต่รับชื่อผู้ใช้ได้ด้วย
        email: { label: "อีเมล หรือ ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(creds) {
        const identifier = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!identifier || !password) return null;

        // มี @ = อีเมล ไม่มี = ชื่อผู้ใช้ แยกด้วยเงื่อนไขนี้เพื่อไม่ให้ค้นสองรอบทุกครั้ง
        // ทั้งสองคอลัมน์เก็บเป็นตัวพิมพ์เล็ก จึงเทียบกับค่าที่ lower มาแล้วได้ตรง ๆ
        const user = await prisma.user.findUnique({
          where: identifier.includes("@") ? { email: identifier } : { username: identifier },
        });

        // เทียบ hash ต่อแม้ไม่เจอผู้ใช้ ไม่งั้นเวลาตอบกลับจะต่างกันจนเดาได้ว่าบัญชีไหนมีอยู่จริง
        if (!user?.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

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
