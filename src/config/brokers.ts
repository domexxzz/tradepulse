/**
 * โบรกที่ใช้รับสิทธิ์อินดิเคเตอร์แทนการจ่ายเงิน (ทางที่ 2)
 *
 * ข้อมูลโบรกเอามาจากคู่มือเปิดบัญชีของน็อต เฉพาะที่เป็นสเปกบัญชีจริงในภาพหน้าจอ
 * ไม่ใส่คะแนนรีวิวหรือจำนวนผู้ใช้ของโบรก เพราะเป็นตัวเลขของบุคคลที่สามที่เราตรวจไม่ได้
 * ขึ้นหน้าเว็บเราแล้วกลายเป็นเราเป็นคนอ้าง
 */

export interface Broker {
  id: string;
  name: string;
  fullName: string;
  platform: string;
  /**
   * ลิงก์สมัครแบบมีรหัสแนะนำของ QVX — ช่องทางเดียวที่ทำให้บัญชีนับเป็นของ QVX
   * ว่าง = ยังไม่มีลิงก์ หน้าเว็บจะไม่โชว์ปุ่มสมัคร
   * ห้ามใส่ลิงก์หน้าแรกของโบรกแทน ลูกค้าที่สมัครผ่านลิงก์ทั่วไปจะไม่ผ่านการตรวจ
   * (เหตุผลปฏิเสธ NOT_QVX_ACCOUNT) ทั้งที่ทำตามทุกขั้น
   */
  signupUrl: string;
  officialUrl: string;
  /** คู่มือเปิดบัญชี (PDF) — ไม่บังคับ */
  guideUrl: string;
  supportLine: string;
  markets: string;
  maxLeverage: string;
  /** เงินฝากขั้นต่ำของโบรกเอง */
  brokerMinDepositUSD: number;
  /** เงื่อนไขของ QVX — ฝากถึงเท่านี้ถึงจะรับสิทธิ์ได้ */
  qvxMinDepositUSD: number;
}

export const BROKERS: Record<string, Broker> = {
  wisdom: {
    id: "wisdom",
    name: "Wisdom",
    fullName: "Wisdom Financial Services",
    platform: "MT5",
    signupUrl: process.env.NEXT_PUBLIC_WISDOM_SIGNUP_URL ?? "",
    officialUrl: "https://www.wisdomtrade.com/",
    guideUrl: process.env.NEXT_PUBLIC_WISDOM_GUIDE_URL ?? "",
    supportLine: "@wisdfx",
    markets: "Forex · หุ้น · ทองคำ · น้ำมัน · Crypto",
    maxLeverage: "1:1,000",
    brokerMinDepositUSD: 50,
    qvxMinDepositUSD: 100,
  },
};

export const DEFAULT_BROKER = "wisdom";

export function getBroker(id: string): Broker | null {
  return BROKERS[id] ?? null;
}

/** เลขบัญชีเทรด — ตัวเลขล้วน เก็บเลข 0 นำหน้าไว้ตามจริง (บางโบรกออกเลขขึ้นต้นด้วย 0) */
export const TRADING_ACCOUNT_RE = /^\d{4,20}$/;

/** ขอต่ออายุได้เมื่อเหลือสิทธิ์ไม่เกินกี่วัน */
export const BROKER_RENEWAL_WINDOW_DAYS = 3;

/**
 * เหตุผลที่ปฏิเสธ — ลูกค้าเห็นข้อความนี้ในหน้าบัญชี
 * เขียนให้ลูกค้ารู้ว่าต้องแก้อะไร ไม่ใช่แค่ว่าไม่ผ่าน
 */
export const BROKER_REJECTION_REASONS = {
  ACCOUNT_NOT_FOUND: "ไม่พบเลขบัญชีนี้ในระบบโบรก — ตรวจเลขบัญชีเทรด MT5 แล้วส่งใหม่",
  NOT_QVX_ACCOUNT: "บัญชีนี้ไม่ได้สมัครผ่านลิงก์ของ QVX — เปิดบัญชีใหม่ผ่านลิงก์ในหน้านี้",
  NOT_ELIGIBLE: "ยอดเงินในบัญชียังไม่ถึงเงื่อนไขขั้นต่ำ — ฝากเพิ่มแล้วส่งคำขอใหม่",
  DUPLICATE_ACCOUNT: "บัญชีนี้ถูกใช้รับสิทธิ์ไปแล้ว",
  INVALID_INFORMATION: "ข้อมูลไม่ตรงกับบัญชีโบรก — ตรวจชื่อและอีเมลที่ใช้สมัคร",
  OTHER: "เหตุผลอื่น",
} as const;
export type BrokerRejectionReason = keyof typeof BROKER_REJECTION_REASONS;

export function isRejectionReason(x: string): x is BrokerRejectionReason {
  return x in BROKER_REJECTION_REASONS;
}
