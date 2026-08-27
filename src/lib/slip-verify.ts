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

const TOKEN = process.env.EASYSLIP_TOKEN;
/** เลข PromptPay ที่เงินต้องเข้า — ตัวเดียวกับที่ใช้สร้าง QR */
const RECEIVER_ID = process.env.PROMPTPAY_ID || "";

/** ตรวจแล้วยอดตรง = อนุมัติออเดอร์ให้อัตโนมัติ (ค่าเริ่มต้น: ปิด ให้แอดมินกดเอง) */
export const slipAutoApprove = process.env.SLIP_AUTO_APPROVE === "true";
export const slipVerifyEnabled = Boolean(TOKEN);

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
 * ส่งรูปสลิปไปให้ EasySlip อ่าน แล้วเทียบยอดกับที่ต้องจ่าย
 * ห้าม throw — ทุกความล้มเหลวคืนสถานะ FAILED เพื่อให้ตกไปที่การตรวจด้วยคน
 */
export async function verifySlip(input: {
  base64: string;
  mime: string;
  expectAmountTHB: number;
  /** เวลาสร้างออเดอร์ ใช้กันสลิปเก่าที่ขุดมาใช้ */
  orderCreatedAt: Date;
}): Promise<SlipVerifyResult> {
  if (!slipVerifyEnabled) return { status: "SKIPPED", note: "ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ" };

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
        note: `สลิปลงวันที่ ${slipDate.toLocaleString("th-TH")} ซึ่งอยู่นอกช่วงเวลาของออเดอร์นี้`,
        transRef,
        amount,
      };
    }

    return { status: "VERIFIED", note: "ยอดตรง บัญชีผู้รับตรง และเป็นสลิปของออเดอร์นี้", transRef, amount };
  } catch (e) {
    return { status: "FAILED", note: e instanceof Error ? e.message : "ติดต่อผู้ให้บริการตรวจสลิปไม่ได้" };
  }
}
