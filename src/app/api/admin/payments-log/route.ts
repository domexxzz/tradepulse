import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * บันทึกเงินเข้าทั้งหมด ดาวน์โหลดเป็น CSV — ใช้ตามคืนเงินให้ถูกคน
 *
 * ทำไมต้องมี: หน้า /admin/orders ดูทีละหน้าและไม่มี transRef กับวันที่ครบ
 * ตอนต้องคืนเงินหลายสิบรายการ ต้องการไฟล์เดียวที่เปิดใน Excel แล้วเช็กไปทีละแถวได้
 *
 * ไม่ดึง slipData (base64 รูปสลิป) เด็ดขาด — แถวละหลาย MB ดึงมาทั้งตารางแล้วหน่วยความจำแตก
 * ต้องการดูรูปให้เปิดจากหน้า /admin/orders รายตัว
 *
 * มี transRef ไว้เทียบกับรายการเดินบัญชีธนาคาร ซึ่งเป็นหลักฐานว่าเงินเข้าจริง
 */

/** ครอบค่าตามกติกา CSV — ชื่อคนไทยมีจุลภาคและเครื่องหมายคำพูดได้ ไม่ครอบแล้วคอลัมน์เลื่อน */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");

export async function GET() {
  await requireAdmin();

  const [slips, payments] = await Promise.all([
    prisma.slipOrder.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        planCode: true,
        amountTHB: true,
        status: true,
        transRef: true,
        verifyStatus: true,
        reviewedAt: true,
        note: true,
        user: { select: { name: true, email: true, username: true, tradingViewUsername: true } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        provider: true,
        providerRef: true,
        amountTHB: true,
        status: true,
        user: { select: { name: true, email: true, username: true, tradingViewUsername: true } },
      },
    }),
  ]);

  const head = [
    "ช่องทาง", "รหัสรายการ", "วันที่", "ชื่อ", "อีเมล", "ชื่อผู้ใช้",
    "TradingView", "แพ็กเกจ", "จำนวนเงิน(บาท)", "สถานะ",
    "เลขอ้างอิงโอน", "ผลตรวจสลิป", "วันที่ตรวจ", "หมายเหตุ",
  ];

  const rows = [
    ...slips.map((s) => [
      "PromptPay", s.id, iso(s.createdAt), s.user.name, s.user.email, s.user.username,
      s.user.tradingViewUsername, s.planCode, s.amountTHB, s.status,
      s.transRef, s.verifyStatus, iso(s.reviewedAt), s.note,
    ]),
    ...payments.map((p) => [
      p.provider, p.id, iso(p.createdAt), p.user.name, p.user.email, p.user.username,
      p.user.tradingViewUsername, "", p.amountTHB, p.status, p.providerRef, "", "", "",
    ]),
  ];

  // BOM ข้างหน้า ไม่งั้น Excel บน Windows เปิดแล้วภาษาไทยเป็นขยะ
  const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="qvx-payments-${stamp}.csv"`,
      // เป็นข้อมูลลูกค้า ห้ามให้ CDN หรือเบราว์เซอร์เก็บไว้
      "cache-control": "no-store",
    },
  });
}
