import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ⚠️ Endpoint ชั่วคราวสำหรับรีเซ็ตรหัสแอดมินครั้งเดียว — ลบทิ้งทันทีหลังใช้
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESET_TOKEN = "-PaBxzRqUYO_u0J_8XTZ8FW80eeXOA5z";

export async function POST(req: NextRequest) {
  let body: { token?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { token, email, password } = body;
  if (!token || token !== RESET_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "email and password (>=8 chars) required" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { passwordHash, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: "update failed", detail: String(e).slice(0, 180) }, { status: 500 });
  }
}
