/**
 * แพ็คเกจสมาชิก — ราคาเดิม
 * savingsPct คำนวณจากส่วนต่างราคาต่อเดือนเทียบแพ็กเกจรายเดือน (มีเหตุผลรองรับ)
 */
export type PlanInterval = "MONTH" | "Q3" | "H6" | "YEAR";

export interface Plan {
  id: PlanInterval;
  name: string;
  priceTHB: number;
  months: number;
  perMonthTHB: number;
  billingNote: string;
  savingsTHB: number;   // ประหยัดเทียบจ่ายรายเดือน
  badge?: string;
  highlight?: boolean;
}

const MONTHLY = 990;

function make(id: PlanInterval, name: string, priceTHB: number, months: number, extra?: Partial<Plan>): Plan {
  const perMonthTHB = Math.round(priceTHB / months);
  const savingsTHB = MONTHLY * months - priceTHB;
  return {
    id, name, priceTHB, months, perMonthTHB, savingsTHB,
    billingNote: months === 1 ? "ชำระทุกเดือน" : `ชำระทุก ${months} เดือน`,
    ...extra,
  };
}

export const plans: Plan[] = [
  make("MONTH", "รายเดือน", 990, 1),
  make("Q3", "ราย 3 เดือน", 2670, 3),
  make("H6", "ราย 6 เดือน", 4740, 6, { badge: "ยอดนิยม", highlight: true }),
  make("YEAR", "รายปี", 7990, 12),
];

export const planIncludes: string[] = [
  "เข้ากลุ่ม Telegram รับสัญญาณสด (เฉพาะสมาชิก)",
  "อินดิเคเตอร์ครบทุกฟีเจอร์ (ใช้บน TradingView)",
  "สัญญาณ Buy / Sell พร้อม Entry / TP / SL",
  "อัปเดตฟังก์ชันใหม่ตลอดอายุสมาชิก",
  "คู่มือและคลาสสอนการใช้งาน",
  "ทีมช่วยเหลือเมื่อติดปัญหา",
];
