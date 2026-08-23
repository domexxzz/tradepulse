import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export const promptpayId = process.env.PROMPTPAY_ID || "";
export const promptpayName = process.env.PROMPTPAY_NAME || "";
export const promptpayEnabled = Boolean(promptpayId);

/** สร้าง QR PromptPay เป็น data URL (คืน null ถ้ายังไม่ตั้งค่า) */
export async function promptpayQrDataUrl(amount: number): Promise<string | null> {
  if (!promptpayId) return null;
  const payload = generatePayload(promptpayId, { amount });
  return QRCode.toDataURL(payload, {
    width: 340,
    margin: 1,
    color: { dark: "#0a0d0b", light: "#ffffff" },
  });
}
