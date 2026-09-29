import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/subscription";
import { formatThaiDate } from "@/lib/date";
import { ensureTelegramInvite } from "@/lib/lifecycle";
import { sendTelegramInviteEmailWithReason } from "@/lib/telegram-invite";
import { revokeInviteLink, currentChatId } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * รายงาน "ใครได้ของครบแล้วบ้าง" ทีละคน
 *
 * ทำไมต้องมี: เรามีตัวนับรวมอยู่หลายที่ (คิวสลิป คิวสิทธิ์ ลิงก์ที่ยังไม่ส่ง)
 * แต่ไม่มีที่ไหนตอบคำถามที่เจ้าของถามจริง ๆ ว่า "ลูกค้าคนนี้ได้ของครบหรือยัง"
 * ตัวเลขรวมเป็นศูนย์ไม่ได้แปลว่าทุกคนได้ครบ — แปลว่าไม่มีงานค้างในคิวเท่านั้น
 * เช่นคนที่ยังไม่กรอก TradingView username จะไม่โผล่ในคิวไหนเลย
 *
 * อ่านอย่างเดียว ไม่แก้อะไร
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gte: now } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      userId: true,
      planCode: true,
      currentPeriodEnd: true,
      user: { select: { name: true, email: true, tradingViewUsername: true } },
    },
  });

  const userIds = subs.map((s) => s.userId);
  const [grants, telegrams] = await Promise.all([
    prisma.accessGrant.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, status: true, grantedAt: true, tradingViewUsername: true },
    }),
    prisma.telegramGrant.findMany({
      where: { userId: { in: userIds }, status: { in: ["PENDING", "ADDED"] } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, status: true, inviteLink: true, notifiedAt: true, chatId: true },
    }),
  ]);

  // แถวล่าสุดของแต่ละคนคือสถานะปัจจุบัน (เรียง desc มาแล้ว จึงเก็บตัวแรกที่เจอ)
  const firstBy = <T extends { userId: string }>(rows: T[]) => {
    const m = new Map<string, T>();
    for (const r of rows) if (!m.has(r.userId)) m.set(r.userId, r);
    return m;
  };
  const grantBy = firstBy(grants);
  const tgBy = firstBy(telegrams);

  const members = subs.map((s) => {
    const g = grantBy.get(s.userId);
    const tg = tgBy.get(s.userId);

    const indicator = !s.user.tradingViewUsername
      ? "ยังไม่กรอก username"
      : g?.status === "GRANTED"
        ? `เพิ่มแล้ว${g.grantedAt ? ` (${formatThaiDate(g.grantedAt)})` : ""}`
        : g?.status === "PENDING"
          ? "รอคิวบอท"
          : g?.status ?? "ไม่มีคิว";

    const telegram = tg?.status === "ADDED"
      ? "เข้ากลุ่มแล้ว"
      : !tg?.inviteLink
        ? "ยังไม่มีลิงก์"
        : tg.notifiedAt
          ? "ส่งลิงก์ทางอีเมลแล้ว รอกดเข้า"
          : "มีลิงก์ แต่ยังไม่ได้ส่งอีเมล";

    return {
      member: s.user.name ?? s.user.email,
      email: s.user.email,
      tradingView: s.user.tradingViewUsername ?? null,
      plan: s.planCode,
      until: s.currentPeriodEnd ? formatThaiDate(s.currentPeriodEnd) : null,
      indicator,
      telegram,
      /** ครบ = ได้ทั้งอินดิเคเตอร์และลิงก์กลุ่มแล้ว ไม่ต้องตามอะไรต่อ */
      complete: indicator.startsWith("เพิ่มแล้ว") && (tg?.status === "ADDED" || Boolean(tg?.notifiedAt)),
    };
  });

  return NextResponse.json({
    ok: true,
    total: members.length,
    complete: members.filter((m) => m.complete).length,
    incomplete: members.filter((m) => !m.complete).length,
    members,
  });
}

/**
 * ออกลิงก์กลุ่มใหม่แล้วส่งอีเมลให้สมาชิกรายเดียว
 *
 * มีไว้สำหรับเคสที่สถานะในระบบบอกว่า "เข้ากลุ่มแล้ว" แต่ลูกค้ายืนยันว่าไม่ได้อยู่
 * ซึ่งเกิดได้จากสถานะค้างจากกลุ่มเดิมก่อนย้ายมา QVX SIGNAL
 * ต่างจากรอบกวาดรายวันตรงที่ตัวนี้ "บังคับออกใหม่" ไม่สนสถานะเดิม
 *
 * ล้างของเก่าทิ้งก่อนเสมอ เพราะลิงก์เชิญผูกกับกลุ่มที่ออกให้ตลอดไป
 * ถ้าไม่ล้าง ระบบจะเห็นว่ามีลิงก์แล้วแล้วส่งลิงก์ห้องเก่าให้ลูกค้าซ้ำอีกรอบ
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { invite?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const email = typeof body.invite === "string" ? body.invite.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "ต้องระบุ invite เป็นอีเมลของสมาชิก" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: `ไม่พบสมาชิกอีเมล ${email}` }, { status: 404 });

  const grant = await prisma.telegramGrant.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "ADDED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, inviteLink: true, status: true, chatId: true },
  });

  if (grant) {
    if (grant.inviteLink) {
      await revokeInviteLink(grant.inviteLink).catch(() => {
        // ลิงก์ของกลุ่มเก่า Telegram จะปฏิเสธ — คาดไว้แล้ว
      });
    }
    await prisma.telegramGrant.update({
      where: { id: grant.id },
      data: {
        status: "PENDING",
        inviteLink: null,
        invitedAt: null,
        notifiedAt: null,
        telegramUserId: null,
        addedAt: null,
        note: "ออกลิงก์ใหม่ตามที่ร้องขอ",
      },
    });
  }

  await ensureTelegramInvite(user.id);
  const result = await sendTelegramInviteEmailWithReason(user.id);

  const after = await prisma.telegramGrant.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "ADDED"] } },
    orderBy: { createdAt: "desc" },
    select: { status: true, inviteLink: true, chatId: true },
  });

  return NextResponse.json({
    ok: result === "sent",
    member: user.name ?? user.email,
    email: user.email,
    before: grant ? { status: grant.status, hadLink: Boolean(grant.inviteLink), chatId: grant.chatId } : null,
    result,
    now: { status: after?.status, hasLink: Boolean(after?.inviteLink), chatId: after?.chatId, currentChatId },
  });
}
