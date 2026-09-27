"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBrokerReviewer } from "@/lib/admin";
import { BROKER_EVENT_TYPE, type BrokerEventType } from "@/config/status";
import { DEFAULT_BROKER, TRADING_ACCOUNT_RE } from "@/config/brokers";

export type BrokerEventState = { ok?: boolean; error?: string };

const LABELS: Record<string, string> = {
  [BROKER_EVENT_TYPE.SIGNUP]: "สมัคร",
  [BROKER_EVENT_TYPE.DEPOSIT]: "ฝาก",
  [BROKER_EVENT_TYPE.WITHDRAWAL]: "ถอน",
};

/**
 * พาร์ตเนอร์/แอดมินบันทึกสิ่งที่เห็นในหลังบ้านโบรกเอง
 *
 * มีไว้เพราะช่วงแรกยังไม่มีอีเมลแจ้งเตือน — บันทึกครั้งเดียวแล้วรอบหน้า
 * (เช่นตอนต่ออายุ) ไม่ต้องเปิดหลังบ้านโบรกซ้ำ และคนอื่นในทีมเห็นด้วยว่าใครตรวจอะไรไว้
 */
export async function logBrokerEventAction(
  _prev: BrokerEventState,
  formData: FormData
): Promise<BrokerEventState> {
  const session = await requireBrokerReviewer();

  const tradingAccount = String(formData.get("tradingAccount") ?? "").replace(/\s+/g, "");
  if (!TRADING_ACCOUNT_RE.test(tradingAccount)) return { error: "เลขบัญชีไม่ถูกต้อง" };

  const type = String(formData.get("type") ?? "") as BrokerEventType;
  if (!(type in LABELS)) return { error: "เลือกว่าเป็นการสมัคร ฝาก หรือถอน" };

  const amountRaw = String(formData.get("amountUSD") ?? "").replace(/,/g, "").trim();
  let amountUSD: number | null = null;
  if (amountRaw) {
    amountUSD = Number(amountRaw);
    if (!Number.isFinite(amountUSD) || amountUSD < 0) return { error: "ยอดเงินไม่ถูกต้อง" };
  }
  if (type !== BROKER_EVENT_TYPE.SIGNUP && amountUSD === null) {
    return { error: "ใส่ยอดเงินด้วย (ใช้ตัดสินเงื่อนไขขั้นต่ำ)" };
  }

  const occurredRaw = String(formData.get("occurredAt") ?? "").trim();
  const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return { error: "วันที่ไม่ถูกต้อง" };
  if (occurredAt.getTime() > Date.now() + 86_400_000) return { error: "วันที่อยู่ในอนาคต" };

  const text = (v: FormDataEntryValue | null, max: number) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };

  await prisma.brokerEvent.create({
    data: {
      broker: DEFAULT_BROKER,
      type,
      tradingAccount,
      accountName: text(formData.get("accountName"), 120),
      accountEmail: text(formData.get("accountEmail"), 200)?.toLowerCase() ?? null,
      amountUSD,
      occurredAt,
      source: "manual",
      loggedById: session.user.id,
    },
  });

  revalidatePath("/admin/wisdom");
  return { ok: true };
}
