/** ยูทิลวันที่ที่ระบบสมาชิกใช้ร่วมกัน — รวมไว้ที่เดียวเพื่อให้การคิดวันหมดอายุตรงกันทุกที่ */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * บวกเดือนแบบไม่ให้เดือนล้น
 * JS ปกติ: 31 ม.ค. + 1 เดือน = 3 มี.ค. (เพราะ ก.พ. ไม่มีวันที่ 31)
 * ที่ถูกสำหรับรอบบิลคือ 28/29 ก.พ. — สมาชิกไม่ควรได้วันเกินหรือขาดจากปฏิทิน
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** จำนวนวันเต็มจากวันนี้ถึงวันที่กำหนด (ติดลบ = เลยมาแล้ว) */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

/** วันที่แบบไทยอ่านง่าย เช่น "25 ส.ค. 2569" */
export function formatThaiDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
