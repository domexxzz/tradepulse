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
  /**
   * โดเมนอีเมลของโบรกเอง — ตัวอ่านอีเมลต้องไม่หยิบที่อยู่พวกนี้มาเป็นอีเมลลูกค้า
   * อีเมลแจ้งเตือนของ Wisdom มี admin@wisdomfinancialservice.com อยู่ทุกฉบับ แต่ไม่มีอีเมลลูกค้าเลย
   * เคยหยิบผิดจนหน้าตรวจขึ้น "อีเมลไม่ตรง" กับลูกค้าทุกคน (30 ก.ย. 2569)
   */
  emailDomains: string[];
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
    /**
     * ลิงก์แนะนำของ QVX — พาร์ตเนอร์ยืนยันตัวนี้เมื่อ 29 ก.ย. 2569
     *
     * เขียนไว้ในโค้ดตรง ๆ ไม่ปล่อยให้ env ว่าง เพราะเดิมอ่านจาก
     * NEXT_PUBLIC_WISDOM_SIGNUP_URL ซึ่งไม่เคยถูกตั้งบน production เลย
     * ผลคือหน้ารับสิทธิ์ไม่มีปุ่มเปิดบัญชีให้กดมาตลอด ลูกค้าไปต่อไม่ได้
     *
     * ไม่ใช่ความลับอยู่แล้ว — NEXT_PUBLIC_* ถูกฝังลงบันเดิลให้เบราว์เซอร์เห็นทั้งหมด
     * ยังเปลี่ยนผ่าน env ได้ถ้าต้องสลับลิงก์ด่วนโดยไม่ deploy
     */
    signupUrl:
      process.env.NEXT_PUBLIC_WISDOM_SIGNUP_URL ??
      "https://zone.wisdomtrade.com/regist-real?invitid=54de69130a6dbed84a692f106f13e928916715b2941cf716670f1e8116ba8573&e=t",
    officialUrl: "https://www.wisdomtrade.com/",
    /** คู่มือเปิดบัญชีของเราเอง ไม่ใช่ PDF ข้างนอก — อยู่ในเว็บ กดแล้วไม่หลุดออกไป */
    guideUrl: process.env.NEXT_PUBLIC_WISDOM_GUIDE_URL ?? "/manual/open-account",
    supportLine: "@wisdfx",
    markets: "Forex · หุ้น · ทองคำ · น้ำมัน · Crypto",
    maxLeverage: "1:1,000",
    emailDomains: ["wisdomfinancialservice.com", "wisdomtrade.com"],
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
