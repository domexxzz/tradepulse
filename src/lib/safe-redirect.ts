/**
 * แปลง callbackUrl ที่แนบมากับหน้าเข้าสู่ระบบ/สมัครสมาชิก ให้เป็น path ในเว็บเราเท่านั้น
 *
 * ค่านี้มาจาก query string ใครจะแนบอะไรมาก็ได้ — ถ้าพาไปตามนั้นตรง ๆ
 * ลิงก์ /login?callbackUrl=https://เว็บปลอม จะส่งลูกค้าที่เพิ่งล็อกอินไปหน้าหลอก (open redirect)
 *
 * รับสองแบบ: path ในเว็บ ("/activation") กับ URL เต็มที่ origin ตรงกับเว็บเรา
 * (proxy ของ NextAuth แนบมาแบบ URL เต็ม) นอกนั้นคืน null ให้ผู้เรียกใช้ปลายทางปกติ
 *
 * ต้อง parse ด้วย URL แล้วเทียบ origin ไม่ใช่เช็คแค่ขึ้นต้นด้วย "/" —
 * "//evil.com" หรือ "/\t/evil.com" ขึ้นต้นด้วย "/" แต่เบราว์เซอร์พาออกนอกเว็บ
 */
export function safeCallbackPath(raw: unknown, siteOrigin: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const origin = new URL(siteOrigin).origin;
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
