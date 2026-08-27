import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const schema = z.object({
  secret: z.string(),
  action: z.enum(["grant", "revoke"]),
  username: z.string().min(1).max(60),
  ok: z.boolean(),
  error: z.string().max(500).nullish(),
});

/** เทียบ secret แบบไม่รั่วเวลา (กันการเดาทีละตัวอักษรจากเวลาตอบกลับ) */
function secretMatches(given: string): boolean {
  const expected = process.env.TV_BOT_SECRET;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * บอท TradingView รายงานผลกลับมาที่นี่
 *
 * ทำไมต้องมีเส้นทางนี้: บอทกดหน้าเว็บ TradingView จริงผ่าน Selenium ใช้เวลา 60-120 วินาที
 * เว็บยืนรอไม่ได้ (Vercel จำกัดเวลา request) จึงสั่งแล้วปล่อย แล้วให้บอทยิงผลกลับทีหลัง
 *
 * ผลที่ล้มเหลวจะไม่ปิดคิว — ปล่อยค้างไว้ให้แอดมินทำมือ พร้อมแจ้งเตือนทาง Telegram
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // [TEMP DIAG] บันทึกสิ่งที่บอทส่งมาจริง เพื่อหาสาเหตุที่สิทธิ์ไม่ขึ้นบน TradingView
  // ปิดบัง secret ไม่ให้หลุดลง log — เอาออกเมื่อวินิจฉัยเสร็จ
  try {
    const raw = body as Record<string, unknown> | null;
    console.log("[tv-callback] payload:", JSON.stringify({ ...raw, secret: raw?.secret ? "<set>" : "<missing>" }));
  } catch {}

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.log("[tv-callback] REJECT 400 invalid payload:", JSON.stringify(parsed.error.issues));
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { secret, action, username, ok, error } = parsed.data;
  if (!secretMatches(secret)) {
    console.log("[tv-callback] REJECT 401 secret ไม่ตรงกับ TV_BOT_SECRET บน Vercel");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  console.log(`[tv-callback] ผ่าน auth — action=${action} username=${username} ok=${ok} error=${error ?? "-"}`);

  const user = await prisma.user.findFirst({
    where: { tradingViewUsername: { equals: username, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    console.log(`[tv-callback] REJECT 404 ไม่พบสมาชิกที่ใช้ tradingViewUsername="${username}"`);
    return NextResponse.json({ error: "ไม่พบสมาชิกที่ใช้ username นี้" }, { status: 404 });
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!grant) {
    console.log(`[tv-callback] REJECT 404 ไม่พบคิวสิทธิ์ของ userId=${user.id}`);
    return NextResponse.json({ error: "ไม่พบคิวสิทธิ์ของสมาชิกรายนี้" }, { status: 404 });
  }

  const now = new Date();

  if (!ok) {
    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: { note: `บอททำงานไม่สำเร็จ: ${error ?? "ไม่ทราบสาเหตุ"}` },
    });
    await sendAdminAlert(
      `⚠️ บอท TradingView ${action === "grant" ? "ให้สิทธิ์" : "ถอนสิทธิ์"}ไม่สำเร็จ
สมาชิก: ${user.name ?? user.email}
TradingView: @${username}
สาเหตุ: ${error ?? "ไม่ทราบ"}
ต้องทำมือที่ /admin/access-queue`
    );
    return NextResponse.json({ ok: true, handled: "failure" });
  }

  await prisma.accessGrant.update({
    where: { id: grant.id },
    data:
      action === "grant"
        ? { status: "GRANTED", grantedAt: now, revokedAt: null, note: "ให้สิทธิ์อัตโนมัติโดยบอท" }
        : { status: "REVOKED", revokedAt: now, note: "ถอนสิทธิ์อัตโนมัติโดยบอท (หมดอายุ)" },
  });

  return NextResponse.json({ ok: true, handled: action });
}
