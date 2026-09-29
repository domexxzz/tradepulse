import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveOrderById } from "@/lib/approve-order";
import { formatTHB } from "@/lib/utils";
import { verifySlip, slipAutoApprove, slipVerifyEnabled } from "@/lib/slip-verify";
import { readSlipQr } from "@/lib/slip-qr";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
/** อนุมัติหลายใบติดกันต้องเผื่อเวลา แต่ละใบไปเรียกบอท TradingView ด้วย */
export const maxDuration = 300;

/**
 * ดูและอนุมัติคิวสลิปจากนอกหน้าเว็บแอดมิน
 *
 * ทำไมต้องมี: หน้า /admin/orders ต้องล็อกอินเป็นแอดมิน ซึ่งเครื่องมืออัตโนมัติ
 * และคนที่ไม่มีเซสชันเข้าไม่ถึง เวลาลูกค้ารอสิทธิ์อยู่แล้วเจ้าของไม่สะดวกเปิดเว็บ
 * ก็ไม่มีทางรู้ด้วยซ้ำว่ามีกี่ใบค้างและแต่ละใบเป็นยังไง
 *
 * ⚠️ ไม่คืน slipData ออกไป — รูปสลิปมีชื่อและเลขบัญชีของลูกค้า
 * ไม่ควรไหลออกนอกหน้าแอดมินที่ล็อกอินแล้ว คืนเฉพาะสิ่งที่ใช้ตัดสินใจ
 *
 * GET  = ดูอย่างเดียว
 * POST { approve: ["id", ...] } = อนุมัติเฉพาะใบที่ระบุ
 *   ต้องระบุ id ทีละใบเสมอ ไม่มีโหมด "อนุมัติทั้งหมด" โดยตั้งใจ —
 *   การเปิดสิทธิ์คือการรับว่าเงินเข้าจริง ต้องมีคนตัดสินใจต่อหนึ่งใบ
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

async function listPending() {
  const rows = await prisma.slipOrder.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      planCode: true,
      amountTHB: true,
      transRef: true,
      verifyStatus: true,
      verifyNote: true,
      note: true,
      createdAt: true,
      user: { select: { email: true, name: true, tradingViewUsername: true } },
    },
  });

  return rows.map((o) => ({
    id: o.id,
    member: o.user.name ?? o.user.email,
    email: o.user.email,
    tradingView: o.user.tradingViewUsername,
    plan: o.planCode,
    amount: formatTHB(o.amountTHB),
    transRef: o.transRef,
    verify: o.verifyStatus,
    verifyNote: o.verifyNote,
    note: o.note,
    submittedAt: o.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
  }));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pending = await listPending();
  return NextResponse.json({ ok: true, count: pending.length, pending });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { approve?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // recheck = ให้บอทย้อนกลับไปตรวจใบที่ค้างอยู่ แล้วอนุมัติให้เองถ้าผ่าน
  //
  // การตรวจอัตโนมัติทำงานตอน "ลูกค้ากดส่งสลิป" เท่านั้น ใบที่ส่งเข้ามาก่อนเปิดระบบ
  // จึงค้างอยู่โดยไม่มีใครตรวจให้ ต้องมีทางสั่งให้ไล่ย้อนหลัง ไม่งั้นต้องรอลูกค้าส่งใหม่
  if ((body as { recheck?: unknown }).recheck === true) return recheckPending();

  const ids = Array.isArray(body.approve) ? body.approve.filter((v): v is string => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ต้องระบุ approve เป็นรายการ id อย่างน้อยหนึ่งใบ" }, { status: 400 });
  }

  const results = [];
  for (const id of ids) {
    // อนุมัติเฉพาะใบที่ยังรอตรวจจริง ๆ — กันกดซ้ำแล้วเปิดสิทธิ์ทับของเดิม
    const order = await prisma.slipOrder.findUnique({ where: { id }, select: { status: true } });
    if (!order) {
      results.push({ id, ok: false, reason: "ไม่พบออเดอร์" });
      continue;
    }
    if (order.status !== "SUBMITTED") {
      results.push({ id, ok: false, reason: `สถานะเป็น ${order.status} แล้ว ไม่ใช่ใบที่รอตรวจ` });
      continue;
    }
    try {
      await approveOrderById(id, "อนุมัติโดยเจ้าของผ่านช่องทางดูแลระบบ");
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, reason: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results, remaining: (await listPending()).length });
}

/**
 * ไล่ตรวจสลิปที่ค้างอยู่ด้วยด่านตรวจปัจจุบัน แล้วอนุมัติให้เองเมื่อผ่านครบ
 *
 * ผลตรวจถูกเขียนกลับลงออเดอร์ทุกใบไม่ว่าจะผ่านหรือไม่ แอดมินจะได้เห็นป้ายผลตรวจ
 * ในหน้าเว็บด้วย ไม่ใช่รู้แค่ในคำตอบของ API ครั้งนี้ครั้งเดียว
 */
async function recheckPending() {
  if (!slipVerifyEnabled) {
    return NextResponse.json({ error: "ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ" }, { status: 400 });
  }

  const orders = await prisma.slipOrder.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      amountTHB: true,
      createdAt: true,
      slipData: true,
      slipMime: true,
      user: { select: { name: true, email: true } },
    },
  });

  const results = [];
  for (const o of orders) {
    const who = o.user.name ?? o.user.email;
    if (!o.slipData) {
      results.push({ id: o.id, member: who, status: "NO_SLIP" });
      continue;
    }

    // slipData เก็บเป็น data URL — ตัดหัวออกให้เหลือ base64 ล้วน
    const base64 = o.slipData.includes(",") ? o.slipData.slice(o.slipData.indexOf(",") + 1) : o.slipData;
    const mime = o.slipMime ?? "image/jpeg";

    const qr = await readSlipQr(base64).catch(() => ({ found: false as const }));
    const verify = await verifySlip({
      base64,
      mime,
      expectAmountTHB: o.amountTHB,
      orderCreatedAt: o.createdAt,
      qrPayload: "payload" in qr ? qr.payload : undefined,
    });

    await prisma.slipOrder.update({
      where: { id: o.id },
      data: { verifyStatus: verify.status, verifyNote: verify.note, verifiedAt: new Date() },
    });

    const approved = verify.status === "VERIFIED" && slipAutoApprove;
    if (approved) await approveOrderById(o.id, "บอทตรวจสลิปย้อนหลังแล้วอนุมัติ");

    await sendAdminAlert(
      approved
        ? `✅ บอทตรวจย้อนหลังแล้วอนุมัติให้
สมาชิก: ${who}
ยอด: ${formatTHB(o.amountTHB)}${verify.amount !== undefined ? ` · อ่านได้ ${formatTHB(verify.amount)}` : ""}
${verify.note}`
        : `🧾 บอทตรวจย้อนหลังแล้วยังไม่ผ่าน
สมาชิก: ${who} · ${formatTHB(o.amountTHB)}
ผล: ${verify.status} — ${verify.note}`
    ).catch(() => {});

    results.push({
      id: o.id,
      member: who,
      status: verify.status,
      note: verify.note,
      amountRead: verify.amount,
      approved,
    });
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    approved: results.filter((r) => r.approved).length,
    results,
    remaining: (await listPending()).length,
  });
}
