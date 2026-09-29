/**
 * ตรวจสลิปโอนเงินอัตโนมัติผ่าน EasySlip (ไม่บังคับ)
 *
 * ยังไม่ตั้ง EASYSLIP_TOKEN = ระบบทำงานแบบเดิม (แอดมินดูสลิปเอง)
 * ตั้งแล้ว = ระบบอ่านสลิปให้ก่อน แล้วเทียบยอดกับออเดอร์ ถ้าตรงและเปิด auto-approve ไว้จะอนุมัติให้เลย
 *
 * ⚠️ ผลตรวจที่ไม่ผ่าน "ไม่ปฏิเสธออเดอร์ทันที" — แค่ติดธงไว้ให้แอดมินดูก่อนตัดสิน
 * ผู้ให้บริการอ่านสลิปพลาดได้ (ภาพเบลอ/ครอบตัด) การตัดสินใจสุดท้ายต้องเป็นคน
 */
import { receiverMatches, isSlipFresh, parseSlipDate } from "./slip-receiver";
import { formatThaiDateTime } from "./date";
import { checkQrIntegrity } from "./slip-qr-verify";
import { readSlipWithAi } from "./slip-ai";

const TOKEN = process.env.EASYSLIP_TOKEN;
/** เลข PromptPay ที่เงินต้องเข้า — ตัวเดียวกับที่ใช้สร้าง QR */
const RECEIVER_ID = process.env.PROMPTPAY_ID || "";

/** ตรวจแล้วยอดตรง = อนุมัติออเดอร์ให้อัตโนมัติ (ค่าเริ่มต้น: ปิด ให้แอดมินกดเอง) */
export const slipAutoApprove = process.env.SLIP_AUTO_APPROVE === "true";
/** อ่านสลิปด้วย AI แทน EasySlip — ใช้ตอนยังไม่มีบัญชีผู้ให้บริการ */
export const slipAiFallback = process.env.SLIP_AI_FALLBACK === "true";
export const slipVerifyEnabled = Boolean(TOKEN) || slipAiFallback;

export type SlipVerifyStatus =
  | "VERIFIED"   // อ่านสลิปได้ และยอดตรงกับออเดอร์
  | "MISMATCH"   // อ่านได้ แต่ยอดไม่ตรง
  | "WRONG_ACCOUNT" // ยอดตรง แต่เงินไม่ได้เข้าบัญชีเรา
  | "STALE"      // ยอดตรง บัญชีตรง แต่เป็นสลิปที่โอนก่อนสร้างออเดอร์นี้
  | "FAILED"     // อ่านไม่ได้ / ผู้ให้บริการมีปัญหา
  | "SKIPPED";   // ยังไม่ได้เปิดใช้งาน

export interface SlipVerifyResult {
  status: SlipVerifyStatus;
  note: string;
  /** เลขอ้างอิงรายการโอน — ใช้กันสลิปเดิมถูกส่งซ้ำแม้ถ่ายรูปใหม่ */
  transRef?: string;
  amount?: number;
}

/** ดึงยอดเงินจากผลลัพธ์ โดยรองรับหลายรูปแบบที่ API อาจคืนมา */
function pickAmount(data: Record<string, unknown> | null): number | undefined {
  if (!data) return undefined;
  const amount = data.amount as unknown;
  if (typeof amount === "number") return amount;
  if (amount && typeof amount === "object") {
    const a = amount as Record<string, unknown>;
    if (typeof a.amount === "number") return a.amount;
    const local = a.local as Record<string, unknown> | undefined;
    if (local && typeof local.amount === "number") return local.amount;
  }
  return undefined;
}

/**
 * ตรวจสลิปด้วยของที่เรามีเอง — AI อ่านตัวเลข + checksum ของ QR
 *
 * ใช้เมื่อยังไม่มี EASYSLIP_TOKEN ผลที่ได้ "อ่อนกว่า" EasySlip อย่างมีนัยสำคัญ
 * เพราะไม่มีใครยืนยันกับธนาคารว่ารายการนี้มีจริง — ดูคำอธิบายใน slip-ai.ts
 *
 * สามด่านเหมือนเดิม แต่เพิ่มด่านศูนย์: QR ต้องไม่ใช่ของปลอมที่คำนวณ checksum ไม่ผ่าน
 * ด่านนี้กันสลิปที่สร้างขึ้นเองทั้งใบหรือแคปจากเว็บทำสลิปปลอมได้
 */
async function verifyWithAi(input: {
  base64: string;
  mime: string;
  expectAmountTHB: number;
  orderCreatedAt: Date;
  qrPayload?: string;
}): Promise<SlipVerifyResult> {
  const qr = checkQrIntegrity(input.qrPayload);
  const transRef = input.qrPayload;

  // ด่าน 0: QR ที่มี checksum แต่คำนวณไม่ตรง = มีคนแก้ payload มา ปฏิเสธทันที
  if (qr.integrity === "invalid") {
    return {
      status: "FAILED",
      note: `QR ในสลิปมี checksum ไม่ตรง (ควรเป็น ${qr.expected} แต่ได้ ${qr.actual}) — น่าสงสัยว่าถูกแก้`,
      transRef,
    };
  }

  const read = await readSlipWithAi({ base64: input.base64, mime: input.mime });
  if (!read.ok || read.amount === undefined) {
    return { status: "FAILED", note: `AI อ่านสลิปไม่ได้: ${read.reason ?? "ไม่ทราบสาเหตุ"}`, transRef };
  }

  const how = `อ่านด้วย ${read.model ?? "AI"} · QR ${qr.integrity === "valid" ? "checksum ตรง" : "ไม่มี checksum"}`;

  // ด่าน 1: ยอดตรงไหม
  if (Math.abs(read.amount - input.expectAmountTHB) > 0.01) {
    return {
      status: "MISMATCH",
      note: `AI อ่านยอดได้ ${read.amount} แต่ออเดอร์นี้ต้องจ่าย ${input.expectAmountTHB} (${how})`,
      transRef,
      amount: read.amount,
    };
  }

  // ด่าน 2: เงินเข้าบัญชีเราจริงไหม (เท่าที่ตัวเลขบนภาพบอก)
  if (!RECEIVER_ID) {
    return { status: "WRONG_ACCOUNT", note: "ยังไม่ได้ตั้ง PROMPTPAY_ID จึงตรวจบัญชีผู้รับไม่ได้", transRef, amount: read.amount };
  }
  if (!receiverMatches(RECEIVER_ID, [read.receiverAccount])) {
    return {
      status: "WRONG_ACCOUNT",
      note: `ยอดตรง แต่บัญชีผู้รับที่อ่านได้ (${read.receiverAccount ?? "อ่านไม่ออก"}${read.receiverName ? ` · ${read.receiverName}` : ""}) ไม่ตรงกับบัญชีที่ใช้รับเงิน`,
      transRef,
      amount: read.amount,
    };
  }

  // ด่าน 3: เป็นสลิปของออเดอร์นี้ ไม่ใช่ของเก่าที่ขุดมา
  const when = parseSlipDate(read.transferredAt);
  if (when && !isSlipFresh(when, input.orderCreatedAt, new Date())) {
    return {
      status: "STALE",
      note: `สลิปลงวันที่ ${formatThaiDateTime(when)} ซึ่งอยู่นอกช่วงเวลาของออเดอร์นี้ (${how})`,
      transRef,
      amount: read.amount,
    };
  }

  return {
    status: "VERIFIED",
    note: `ยอดตรง บัญชีผู้รับตรง และเป็นสลิปของออเดอร์นี้ (${how}) — ยังไม่ได้ยืนยันกับธนาคาร`,
    transRef,
    amount: read.amount,
  };
}

/**
 * ส่งรูปสลิปไปให้ EasySlip อ่าน แล้วเทียบยอดกับที่ต้องจ่าย
 * ห้าม throw — ทุกความล้มเหลวคืนสถานะ FAILED เพื่อให้ตกไปที่การตรวจด้วยคน
 */
export async function verifySlip(input: {
  base64: string;
  mime: string;
  expectAmountTHB: number;
  /** เวลาสร้างออเดอร์ ใช้กันสลิปเก่าที่ขุดมาใช้ */
  orderCreatedAt: Date;
  /** ค่าดิบจาก QR — ทางที่ใช้ AI ต้องใช้ตรวจ checksum ว่าสลิปไม่ถูกแก้ */
  qrPayload?: string;
}): Promise<SlipVerifyResult> {
  if (!slipVerifyEnabled) return { status: "SKIPPED", note: "ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ" };

  // ไม่มีบัญชี EasySlip ก็ใช้ของเราเองไปก่อน — อ่อนกว่าแต่ดีกว่าไม่ตรวจอะไรเลย
  if (!TOKEN) return verifyWithAi(input);

  try {
    const form = new FormData();
    const bytes = Buffer.from(input.base64, "base64");
    form.append("file", new Blob([new Uint8Array(bytes)], { type: input.mime }), "slip.jpg");

    const res = await fetch("https://developer.easyslip.com/api/v1/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | { status?: number; message?: string; data?: Record<string, unknown> }
      | null;

    if (!res.ok || !json?.data) {
      return { status: "FAILED", note: `อ่านสลิปไม่สำเร็จ: ${json?.message ?? `HTTP ${res.status}`}` };
    }

    const amount = pickAmount(json.data);
    const transRef = typeof json.data.transRef === "string" ? json.data.transRef : undefined;

    if (amount === undefined) {
      return { status: "FAILED", note: "อ่านยอดเงินจากสลิปไม่ได้", transRef };
    }
    if (Math.round(amount) !== Math.round(input.expectAmountTHB)) {
      return {
        status: "MISMATCH",
        note: `ยอดในสลิป ${amount.toLocaleString("th-TH")} บาท ไม่ตรงกับออเดอร์ ${input.expectAmountTHB.toLocaleString("th-TH")} บาท`,
        transRef,
        amount,
      };
    }

    // ---- ด่าน 2: เงินเข้าบัญชีเราจริงไหม ----
    // ยอดตรงอย่างเดียวไม่พอ ถ้าไม่เช็คตรงนี้ คนโอนยอดตรงเข้าบัญชีใครก็ได้
    // แล้วเอาสลิปมาอัป จะได้สมาชิกฟรีทันทีเมื่อเปิด auto-approve
    const receiver = json.data.receiver as Record<string, unknown> | undefined;
    const rAccount = receiver?.account as Record<string, unknown> | undefined;
    const rBank = rAccount?.bank as Record<string, unknown> | undefined;
    const rProxy = rAccount?.proxy as Record<string, unknown> | undefined;
    const receiverRefs = [rProxy?.account, rBank?.account].map((v) =>
      typeof v === "string" ? v : undefined
    );

    if (!RECEIVER_ID) {
      // ไม่รู้ว่าบัญชีเราคือเลขอะไร ก็ยืนยันผู้รับไม่ได้ ต้องให้คนดู
      return {
        status: "WRONG_ACCOUNT",
        note: "ยังไม่ได้ตั้ง PROMPTPAY_ID จึงตรวจบัญชีผู้รับไม่ได้",
        transRef,
        amount,
      };
    }
    if (!receiverMatches(RECEIVER_ID, receiverRefs)) {
      return {
        status: "WRONG_ACCOUNT",
        note: "ยอดตรง แต่บัญชีผู้รับในสลิปไม่ตรงกับบัญชีที่ใช้รับเงิน",
        transRef,
        amount,
      };
    }

    // ---- ด่าน 3: เป็นสลิปของออเดอร์นี้ ไม่ใช่ของเก่า ----
    // ไม่มีวันที่ในสลิปก็ยังปล่อยผ่าน เพราะ transRef เป็น unique อยู่แล้ว
    // สลิปใบหนึ่งจึงใช้ได้ครั้งเดียวทั้งระบบ ความเสี่ยงที่เหลือจึงจำกัด
    const slipDate = parseSlipDate(json.data.date);
    if (slipDate && !isSlipFresh(slipDate, input.orderCreatedAt, new Date())) {
      return {
        status: "STALE",
        note: `สลิปลงวันที่ ${formatThaiDateTime(slipDate)} ซึ่งอยู่นอกช่วงเวลาของออเดอร์นี้`,
        transRef,
        amount,
      };
    }

    return { status: "VERIFIED", note: "ยอดตรง บัญชีผู้รับตรง และเป็นสลิปของออเดอร์นี้", transRef, amount };
  } catch (e) {
    return { status: "FAILED", note: e instanceof Error ? e.message : "ติดต่อผู้ให้บริการตรวจสลิปไม่ได้" };
  }
}
