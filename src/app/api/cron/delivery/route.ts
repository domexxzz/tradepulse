import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/subscription";
import { formatThaiDate } from "@/lib/date";
import { ensureTelegramInvite } from "@/lib/lifecycle";
import { sendTelegramInviteEmailWithReason } from "@/lib/telegram-invite";
import { revokeInviteLink, currentChatId, sendAdminAlert } from "@/lib/telegram";
import { revokeTradingViewAccess } from "@/lib/tradingview";
import { syncTradingViewGrant } from "@/lib/lifecycle";

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

  let body: { invite?: unknown; setTradingView?: unknown; resync?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (body.setTradingView) return setTradingViewUsername(body.setTradingView);
  if (body.resync) return resyncActiveMembers(body.resync);

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

/**
 * ตั้งวันหมดอายุบน TradingView + ลิงก์กลุ่ม ให้ตรงกับแพ็กเกจของสมาชิกที่ยังใช้งานอยู่
 *
 * ทำไมต้องมี: บั๊กต่ออายุทำให้คนที่ต่อ "ก่อน" หมดอายุไม่ถูกสั่งต่อสิทธิ์เลย
 * (syncTradingViewGrant หาคิวสถานะ GRANTED ไม่เจอแล้ว return เงียบ ๆ)
 * แก้โค้ดแล้วก็แก้แต่รอบถัดไป — คนที่ต่ออายุไปแล้วยังค้างอยู่ที่วันหมดอายุเดิม
 * และไม่มีคิวไหนหยิบพวกเขาขึ้นมาอีก เพราะ reconcile ไล่เฉพาะ PENDING
 *
 * ตัวนี้คือรอบซ่อมย้อนหลัง สั่งซ้ำได้ไม่เสียหาย: การเพิ่มสิทธิ์คือการ "ตั้งวันหมดอายุ"
 * ไม่ใช่การบวกวันเพิ่ม สั่งสองครั้งจึงได้วันเดียวกัน
 *
 *   { "resync": true }                        → สมาชิกที่ยังใช้งานอยู่ทุกคน
 *   { "resync": ["a@b.com", "c@d.com"] }      → เฉพาะรายที่ระบุ
 *   { "resync": { "dry": true } }             → ดูว่าจะแตะใครบ้าง ไม่สั่งอะไรเลย
 */
async function resyncActiveMembers(input: unknown) {
  const emails =
    Array.isArray(input)
      ? input.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase())
      : [];
  const dry = typeof input === "object" && input !== null && (input as { dry?: unknown }).dry === true;

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      currentPeriodEnd: { gte: new Date() },
      ...(emails.length ? { user: { email: { in: emails, mode: "insensitive" as const } } } : {}),
    },
    // เรียงตามวันหมดอายุใกล้สุดก่อน คนที่เสี่ยงถูกตัดสิทธิ์วันนี้ต้องได้คิวแรก
    orderBy: { currentPeriodEnd: "asc" },
    take: 200,
    select: {
      userId: true,
      currentPeriodEnd: true,
      user: { select: { email: true, name: true, tradingViewUsername: true } },
    },
  });

  const touched: { member: string; email: string | null; tradingView: string | null; until: string | null; indicator: string }[] = [];

  for (const s of subs) {
    const row = {
      member: s.user.name ?? s.user.email ?? s.userId,
      email: s.user.email,
      tradingView: s.user.tradingViewUsername,
      until: s.currentPeriodEnd ? formatThaiDate(s.currentPeriodEnd) : null,
      indicator: "",
    };

    if (!s.user.tradingViewUsername) {
      row.indicator = "ข้าม — ยังไม่กรอก username";
      touched.push(row);
      continue;
    }
    if (dry) {
      row.indicator = "จะสั่งบอทต่ออายุให้";
      touched.push(row);
      continue;
    }

    try {
      await syncTradingViewGrant(s.userId);
      await ensureTelegramInvite(s.userId);
      row.indicator = "สั่งบอทแล้ว รอผลยืนยัน";
    } catch (e) {
      row.indicator = `สั่งไม่ได้: ${e instanceof Error ? e.message : "ไม่ทราบ"}`;
    }
    touched.push(row);
  }

  const dispatched = touched.filter((t) => t.indicator.startsWith("สั่งบอทแล้ว")).length;
  if (!dry && dispatched > 0) {
    await sendAdminAlert(
      `🔁 สั่งตั้งวันหมดอายุใหม่ให้สมาชิก ${dispatched} ราย\nรอบซ่อมย้อนหลังของบั๊กต่ออายุ — ผลจริงตามมาทาง callback`
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, dry, total: touched.length, dispatched, members: touched });
}

/**
 * เปลี่ยนชื่อ TradingView แทนลูกค้า — ใช้เมื่อลูกค้าแจ้งผ่านแอดมินว่ากรอกผิด
 *
 * หน้าเว็บให้ลูกค้าแก้เองได้อยู่แล้ว แต่หลายคนทักแอดมินแทนเพราะเข้าหน้าบัญชีไม่เป็น
 * ของเดิมไม่มีทางทำให้เลย ต้องรอลูกค้าทำเอง ซึ่งบางคนไม่ทำสักที
 * (1 ต.ค. 69 ขอมา 2 รายในวันเดียว)
 *
 * ถอนชื่อเก่าออกจากสคริปต์ก่อนเสมอ ไม่งั้นบัญชีที่พิมพ์ผิดได้ใช้อินดิเคเตอร์ฟรีต่อไป
 */
async function setTradingViewUsername(input: unknown) {
  const d = input as { email?: unknown; username?: unknown };
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  const username = typeof d.username === "string" ? d.username.trim() : "";
  if (!email || !username) {
    return NextResponse.json({ error: "ต้องระบุ setTradingView เป็น { email, username }" }, { status: 400 });
  }
  // กฎเดียวกับฟอร์มที่ลูกค้ากรอกเอง (src/lib/actions/account.ts)
  if (!/^[a-zA-Z0-9_]{3,40}$/.test(username)) {
    return NextResponse.json({ error: "username ใช้ได้เฉพาะ a-z, 0-9 และ _ ยาว 3-40 ตัว" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, tradingViewUsername: true },
  });
  if (!user) return NextResponse.json({ error: `ไม่พบสมาชิกอีเมล ${email}` }, { status: 404 });

  const previous = user.tradingViewUsername;
  // ชื่อตรงอยู่แล้วก็ยังต้องสั่งต่อ เพราะเป้าหมายคือ "บอทเพิ่มชื่อนี้ให้แล้วจริง"
  // ไม่ใช่แค่ "ชื่อในฐานข้อมูลถูก" — สองอย่างนี้หลุดจากกันได้ และเคยหลุดมาแล้ว
  const sameName = previous === username;

  if (!sameName) {
    await prisma.user.update({ where: { id: user.id }, data: { tradingViewUsername: username } });
  }
  await prisma.accessGrant.updateMany({
    where: { userId: user.id, status: "PENDING" },
    data: { tradingViewUsername: username },
  });

  let revoked: string | null = null;
  if (previous && !sameName) {
    const res = await revokeTradingViewAccess(previous).catch((e) => ({
      ok: false,
      reason: e instanceof Error ? e.message : "ไม่ทราบ",
    }));
    // ok = บอทรับงานเข้าคิวแล้ว ไม่ใช่ถอนสำเร็จ — ผลจริงตามมาทาง callback ทีหลัง
    // อย่าเขียนว่า "สำเร็จ" เด็ดขาด เคยทำให้เข้าใจผิดว่าถอนเรียบร้อยแล้วทั้งที่ล้มเหลว
    revoked = res.ok ? "ส่งคำสั่งถอนให้บอทแล้ว (รอผลจริง)" : `สั่งไม่ได้: ${"reason" in res ? res.reason : "ไม่ทราบ"}`;
    if (!res.ok) {
      await sendAdminAlert(
        `⚠️ ถอนชื่อเก่าออกจาก TradingView ไม่สำเร็จ\nสมาชิก: ${user.name ?? user.email}\nชื่อเก่า: ${previous}\nชื่อใหม่: ${username}\nต้องไปกดลบ ${previous} เองที่ /admin/access-queue`
      ).catch(() => {});
    }
  }

  /**
   * ปลดคิวให้กลับมารอ ก่อนสั่งบอทเพิ่มชื่อใหม่
   *
   * syncTradingViewGrant จะไม่ทำอะไรเลยถ้าไม่เจอคิวสถานะ PENDING/PENDING_REVOKE/REVOKED
   * คนที่เคยได้อินดิเคเตอร์แล้วจะเป็น GRANTED การเปลี่ยนชื่อจึงเงียบสนิท — ถอนชื่อเก่า
   * ออกไปแต่ไม่เคยเพิ่มชื่อใหม่ ลูกค้าเหลือศูนย์ (เจอจริงกับเคสแรกที่ใช้คำสั่งนี้)
   * ตั้งกลับเป็น PENDING ตรงกับความจริงด้วย เพราะสิทธิ์ภายใต้ชื่อใหม่ยังไม่มี
   */
  await prisma.accessGrant.updateMany({
    where: { userId: user.id, status: "GRANTED" },
    data: { status: "PENDING", tradingViewUsername: username, note: `เปลี่ยนชื่อจาก ${previous ?? "-"} เป็น ${username}` },
  });

  await syncTradingViewGrant(user.id);

  const after = await prisma.accessGrant.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, note: true },
  });

  return NextResponse.json({
    ok: true,
    member: user.name ?? user.email,
    email: user.email,
    previous,
    username,
    revokedPrevious: revoked,
    grantNow: after,
  });
}
