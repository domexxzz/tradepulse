/**
 * ตรวจ "ผู้รับเงิน" และ "ความสดของสลิป" — สองด่านที่หายไปเมื่อให้บอทอนุมัติเอง
 *
 * ⚠️ ทำไมถึงต้องมี:
 * ของเดิม verifySlip() เทียบแค่ยอดเงิน ตอนแอดมินกดเองยังพอไหว เพราะคนจะเหลือบ
 * ดูชื่อผู้รับบนสลิปอยู่แล้ว แต่พอเปิด SLIP_AUTO_APPROVE ด่านสายตาคนหายไปทั้งด่าน
 * เหลือแค่ "ยอดตรง" อย่างเดียว ซึ่งโจมตีได้ตรง ๆ สองทาง:
 *
 *   1. โอนยอดตรงเข้าบัญชีใครก็ได้ (เช่นบัญชีตัวเองอีกใบ) แล้วอัปสลิปนั้น
 *   2. เอาสลิปเก่าที่เคยโอนยอดเท่ากันมาใช้ (transRef ยังไม่เคยถูกใช้ในเว็บ)
 *
 * ไฟล์นี้เลยแยกออกมาเป็นฟังก์ชันบริสุทธิ์ ไม่ยุ่งกับเน็ตเวิร์ก จะได้เขียนเทสต์
 * ครอบตรรกะนี้ได้จริงโดยไม่ต้องยิง API ของผู้ให้บริการ
 */

/** ยอมให้สลิปเก่ากว่าเวลาสร้างออเดอร์ได้เท่านี้ (เผื่อนาฬิกาคลาดและจ่ายแทบพร้อมกัน) */
const BACKDATE_GRACE_MS = 30 * 60 * 1000;
/** ยอมให้สลิปใหม่กว่าเวลาปัจจุบันได้เท่านี้ (เผื่อนาฬิกาธนาคารเดินเร็ว) */
const FUTURE_GRACE_MS = 30 * 60 * 1000;
/** ต้องมีเลขจริง (ไม่ใช่ x) ตรงกันอย่างน้อยเท่านี้ถึงจะนับว่าใช่บัญชีเรา */
const MIN_REAL_DIGITS = 4;

/**
 * ตัดให้เหลือเฉพาะตัวเลขกับตัวปิดบัง
 *
 * สลิปธนาคารไทยปิดบังเลขบัญชีเสมอ เช่น "xxx-xxx-7177" หรือ "xxx-x-x1234-x"
 * จึงเทียบตรง ๆ ไม่ได้ ต้องเก็บ x ไว้เป็นไวลด์การ์ดแล้วเทียบทีละตำแหน่ง
 */
export function normalizeAccountRef(raw: string): string {
  return raw.toLowerCase().replace(/[^0-9x]/g, "");
}

/**
 * เลขบัญชีจากสลิปเข้ากันได้กับเลขที่เราตั้งไว้หรือไม่
 *
 * เทียบชิดขวา เพราะสลิปมักตัดเลขหน้าออกและเหลือท้ายไว้
 * ตำแหน่งที่เป็น x = ผ่านอัตโนมัติ, ตำแหน่งที่เป็นเลข = ต้องตรงเป๊ะ
 * และต้องมีเลขจริงตรงกันอย่างน้อย MIN_REAL_DIGITS ตัว ไม่งั้น "xxxxxxxxxx"
 * จะกลายเป็นผ่านทุกกรณี
 */
export function accountRefMatches(configuredId: string, slipRef: string): boolean {
  const want = configuredId.replace(/\D/g, "");
  const got = normalizeAccountRef(slipRef);
  if (!want || !got) return false;

  let realDigits = 0;
  // เดินจากท้ายเข้าหาหัว เท่ากับความยาวที่สั้นกว่าของสองฝั่ง
  const steps = Math.min(want.length, got.length);
  for (let i = 1; i <= steps; i++) {
    const w = want[want.length - i];
    const g = got[got.length - i];
    if (g === "x") continue;
    if (g !== w) return false;
    realDigits++;
  }

  return realDigits >= MIN_REAL_DIGITS;
}

/**
 * เงินเข้าบัญชีเราจริงไหม — ลองเทียบทั้งช่อง PromptPay และช่องเลขบัญชี
 * ผ่านช่องใดช่องหนึ่งก็พอ เพราะสลิปแต่ละธนาคารใส่ข้อมูลไม่เหมือนกัน
 */
export function receiverMatches(
  configuredId: string,
  candidates: (string | undefined | null)[]
): boolean {
  if (!configuredId) return false;
  return candidates.some((c) => typeof c === "string" && accountRefMatches(configuredId, c));
}

/**
 * สลิปนี้เป็นการโอนของออเดอร์นี้จริงไหม (ไม่ใช่สลิปเก่าที่ขุดมาใช้)
 *
 * ออเดอร์ถูกสร้างตอนกดเลือกแพ็กเกจ การโอนจึงต้องเกิด "หลัง" ออเดอร์เสมอ
 * เผื่อ grace ไว้ทั้งสองด้านเพราะนาฬิกาของธนาคารกับเซิร์ฟเวอร์ไม่ตรงกันเป๊ะ
 */
export function isSlipFresh(slipDate: Date, orderCreatedAt: Date, now: Date): boolean {
  const t = slipDate.getTime();
  if (!Number.isFinite(t)) return false;
  return t >= orderCreatedAt.getTime() - BACKDATE_GRACE_MS && t <= now.getTime() + FUTURE_GRACE_MS;
}

/** อ่านวันที่จากสลิป — คืน null ถ้าไม่มีหรืออ่านไม่ออก (ผู้เรียกตัดสินเองว่าจะทำยังไงต่อ) */
export function parseSlipDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}
