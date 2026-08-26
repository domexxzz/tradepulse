import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * จุดตรวจชั่วคราว — ใช้ไล่หาสาเหตุที่สิทธิ์แอดมินไม่ตรงกันระหว่าง session กับฐานข้อมูล
 * แสดงเฉพาะข้อมูลของคนที่ล็อกอินอยู่เอง และไม่เปิดเผยค่า ADMIN_EMAILS
 * ลบทิ้งเมื่อแก้ปัญหาเสร็จ
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ loggedIn: false });

  const id = session.user.id;
  const dbUser = id
    ? await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } })
    : null;

  const raw = process.env.ADMIN_EMAILS ?? "";
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  return NextResponse.json({
    loggedIn: true,
    session: {
      id: id ?? null,
      email: session.user.email ?? null,
      role: session.user.role ?? null,
    },
    database: {
      found: Boolean(dbUser),
      email: dbUser?.email ?? null,
      role: dbUser?.role ?? null,
    },
    adminEmails: {
      isSet: raw.length > 0,
      count: list.length,
      matchesMyEmail: dbUser?.email ? list.includes(dbUser.email.toLowerCase()) : false,
    },
  });
}
