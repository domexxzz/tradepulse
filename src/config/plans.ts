/**
 * แพ็คเกจสมาชิก
 *
 * โปรเปิดตัว: 300 คนแรกที่จ่ายเงินได้รายเดือน ฿990 ครบแล้วขึ้นเป็น ฿1,290
 * เฉพาะแพ็กเกจรายเดือนที่เปลี่ยน — 3/6/12 เดือนราคาเท่าเดิม
 * สมาชิกที่ได้ราคาโปรจะถูกล็อกราคาไว้ ต่ออายุกี่รอบก็จ่ายเท่าเดิม (User.lockedMonthlyTHB)
 *
 * savingsTHB คิดจากส่วนต่างเทียบ "ราคารายเดือนที่ใช้อยู่จริงตอนนั้น" จึงเป็นตัวเลขจริงเสมอ
 * ไม่ใช่ตัวเลขที่ตั้งไว้ให้ดูเยอะ
 */
export type PlanInterval = "MONTH" | "Q3" | "H6" | "YEAR";

export interface Plan {
  id: PlanInterval;
  name: string;
  priceTHB: number;
  months: number;
  perMonthTHB: number;
  billingNote: string;
  savingsTHB: number;
  badge?: string;
  highlight?: boolean;
}

/** จำนวนที่นั่งราคาโปร นับจากสมาชิกที่จ่ายเงินแล้ว */
export const PROMO_SEATS = 300;
/** ราคารายเดือนช่วงโปร */
export const MONTHLY_PROMO = 990;
/** ราคารายเดือนหลังโปรเต็ม */
export const MONTHLY_REGULAR = 1290;

function make(
  id: PlanInterval,
  name: string,
  priceTHB: number,
  months: number,
  monthlyBase: number,
  extra?: Partial<Plan>
): Plan {
  return {
    id,
    name,
    priceTHB,
    months,
    perMonthTHB: Math.round(priceTHB / months),
    savingsTHB: monthlyBase * months - priceTHB,
    billingNote: months === 1 ? "ชำระทุกเดือน" : `ชำระทุก ${months} เดือน`,
    ...extra,
  };
}

/** สร้างรายการแพ็กเกจจากราคารายเดือนที่ใช้อยู่ — มีแค่แพ็กเกจรายเดือนที่ราคาเปลี่ยนตาม */
export function plansFor(monthlyTHB: number): Plan[] {
  return [
    make("MONTH", "รายเดือน", monthlyTHB, 1, monthlyTHB),
    make("Q3", "ราย 3 เดือน", 2670, 3, monthlyTHB),
    make("H6", "ราย 6 เดือน", 4740, 6, monthlyTHB, { badge: "ยอดนิยม", highlight: true }),
    make("YEAR", "รายปี", 7990, 12, monthlyTHB),
  ];
}

/**
 * แคตตาล็อกราคาปกติ — ใช้ตอนที่ยังไม่ต้องรู้ราคาจริงของผู้ใช้
 * เช่น หน้าแอดมินที่ใช้แค่ชื่อแพ็กเกจ หรือคำนวณจำนวนเดือน
 * จุดที่แสดงหรือเรียกเก็บเงินจริงต้องใช้ราคาจาก lib/pricing.ts เท่านั้น
 */
export const plans: Plan[] = plansFor(MONTHLY_REGULAR);

export const planIncludes: string[] = [
  "เข้ากลุ่ม Telegram รับสัญญาณสด (เฉพาะสมาชิก)",
  "อินดิเคเตอร์ครบทุกฟีเจอร์ (ใช้บน TradingView)",
  "สัญญาณ Buy / Sell พร้อม Entry / TP / SL",
  "อัปเดตฟังก์ชันใหม่ตลอดอายุสมาชิก",
  "คู่มือและคลาสสอนการใช้งาน",
  "ทีมช่วยเหลือเมื่อติดปัญหา",
];
