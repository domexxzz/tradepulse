/**
 * ตรวจสลิปโอนเงินอัตโนมัติผ่าน EasySlip (ไม่บังคับ)
 *
 * ยังไม่ตั้ง EASYSLIP_TOKEN = ระบบทำงานแบบเดิม (แอดมินดูสลิปเอง)
 * ตั้งแล้ว = ระบบอ่านสลิปให้ก่อน แล้วเทียบยอดกับออเดอร์ ถ้าตรงและเปิด auto-approve ไว้จะอนุมัติให้เลย
 *
 * ⚠️ ผลตรวจที่ไม่ผ่าน "ไม่ปฏิเสธออเดอร์ทันที" — แค่ติดธงไว้ให้แอดมินดูก่อนตัดสิน
 * ผู้ให้บริการอ่านสลิปพลาดได้ (ภาพเบลอ/ครอบตัด) การตัดสินใจสุดท้ายต้องเป็นคน
 */
const TOKEN = process.env.EASYSLIP_TOKEN;

/** ตรวจแล้วยอดตรง = อนุมัติออเดอร์ให้อัตโนมัติ (ค่าเริ่มต้น: ปิด ให้แอดมินกดเอง) */
export const slipAutoApprove = process.env.SLIP_AUTO_APPROVE === "true";
export const slipVerifyEnabled = Boolean(TOKEN);

export type SlipVerifyStatus =
  | "VERIFIED"   // อ่านสลิปได้ และยอดตรงกับออเดอร์
  | "MISMATCH"   // อ่านได้ แต่ยอดไม่ตรง
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

    return { status: "VERIFIED", note: "ยอดในสลิปตรงกับออเดอร์", transRef, amount };
  } catch (e) {
    return { status: "FAILED", note: e instanceof Error ? e.message : "ติดต่อผู้ให้บริการตรวจสลิปไม่ได้" };
  }
}
