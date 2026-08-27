/**
 * แพ็คเกจสมาชิก
 *
 * โครงราคามีสองชุด:
 *
 *   ราคาเต็ม        = MONTHLY_REGULAR x จำนวนเดือน (ไม่มีส่วนลดตามระยะเวลา)
 *   Founding 300    = ราคาที่ 300 สมาชิกแรกจ่ายจริง กำหนดเป็นตัวเลขต่อแพ็กเกจ
 *
 * สมาชิกที่ได้ราคา Founding จะถูกล็อกราคาไว้ (User.lockedMonthlyTHB = MONTHLY_PROMO)
 * ต่ออายุกี่รอบก็ยังได้ชุดราคา Founding เท่าเดิม
 *
 * ⚠️ ผลที่ตามมาซึ่งต้องรู้ไว้: พอที่นั่ง Founding เต็ม ทุกแพ็กเกจจะเฉลี่ยเท่ากันหมด
 * ที่ 1,290/เดือน คือจ่ายยาวขึ้นแล้ว "ไม่ได้ถูกลง" เลย ตรงตามตารางราคาที่ตั้งไว้
 * ถ้าต้องการให้แพ็กเกจยาวยังมีส่วนลดหลังหมดโปร ให้เพิ่มชุดราคาที่สามเข้ามา
 *
 * savingsTHB = ราคาเต็ม - ราคาที่จ่ายจริง จึงเป็นส่วนต่างจริงเสมอ
 * ไม่ใช่ตัวเลขที่ตั้งไว้ให้ดูเยอะ (หมดโปรแล้วค่านี้จะเป็น 0 เองโดยอัตโนมัติ)
 */
export type PlanInterval = "MONTH" | "Q3" | "H6" | "YEAR";

export interface Plan {
  id: PlanInterval;
  name: string;
  /** ราคาที่ต้องจ่ายจริงสำหรับผู้ใช้รายนี้ */
  priceTHB: number;
  /** ราคาเต็มไว้เทียบให้เห็นส่วนต่าง — เท่ากับ priceTHB เมื่อหมดโปรแล้ว */
  listPriceTHB: number;
  months: number;
  perMonthTHB: number;
  billingNote: string;
  savingsTHB: number;
  badge?: string;
  highlight?: boolean;
}

/** จำนวนที่นั่งราคาโปร นับจากสมาชิกที่จ่ายเงินแล้ว */
export const PROMO_SEATS = 300;
/** ราคารายเดือนช่วง Founding 300 */
export const MONTHLY_PROMO = 999;
/** ราคารายเดือนปกติ (หลังที่นั่ง Founding เต็ม) */
export const MONTHLY_REGULAR = 1290;

const MONTHS: Record<PlanInterval, number> = { MONTH: 1, Q3: 3, H6: 6, YEAR: 12 };

const NAMES: Record<PlanInterval, string> = {
  MONTH: "รายเดือน",
  Q3: "ราย 3 เดือน",
  H6: "ราย 6 เดือน",
  YEAR: "รายปี",
};

/**
 * ราคา Founding 300 — ตัวเลขที่ 300 คนแรกจ่ายจริง
 * ตั้งเป็นค่าคงที่ ไม่ได้คิดจากเปอร์เซ็นต์ เพราะเป็นราคาที่เลือกมาให้ลงตัว
 * เฉลี่ยต่อเดือนที่ได้: 999 / 963 / 932 / 899
 */
const FOUNDING_PRICE: Record<PlanInterval, number> = {
  MONTH: 999,
  Q3: 2890,
  H6: 5590,
  YEAR: 10790,
};

const ORDER: PlanInterval[] = ["MONTH", "Q3", "H6", "YEAR"];

/**
 * สร้างรายการแพ็กเกจจากราคารายเดือนที่ผู้ใช้คนนี้ได้
 *
 * รับเป็น "ราคารายเดือน" ไม่ใช่ boolean เพื่อให้เข้ากับ User.lockedMonthlyTHB
 * ที่เก็บราคาที่ล็อกไว้เป็นตัวเลข — ส่งค่านั้นเข้ามาตรง ๆ ได้เลย
 */
export function plansFor(monthlyTHB: number): Plan[] {
  const founding = monthlyTHB === MONTHLY_PROMO;

  return ORDER.map((id) => {
    const months = MONTHS[id];
    const listPriceTHB = MONTHLY_REGULAR * months;
    const priceTHB = founding ? FOUNDING_PRICE[id] : listPriceTHB;

    return {
      id,
      name: NAMES[id],
      months,
      listPriceTHB,
      priceTHB,
      perMonthTHB: Math.round(priceTHB / months),
      savingsTHB: listPriceTHB - priceTHB,
      billingNote: months === 1 ? "ชำระทุกเดือน" : `ชำระทุก ${months} เดือน`,
      ...(id === "H6" ? { badge: "ยอดนิยม", highlight: true } : {}),
    };
  });
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
