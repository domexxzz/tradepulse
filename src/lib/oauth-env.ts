/**
 * คีย์ OAuth ของ Google/LINE — อ่านได้จากชื่อ env สองแบบ
 *
 * NextAuth v5 อ่าน `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` ให้เอง แต่ของจริงบน
 * production ตั้งชื่อไว้ว่า `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` มาแต่แรก
 * (LINE ก็แบบเดียวกัน) provider จึงไม่เคยถูกเปิดเลย — `/api/auth/providers` เหลือ
 * แค่ credentials ลูกค้าสมัครได้ทางรหัสผ่านทางเดียวโดยไม่มีใครรู้ (เจอ 28 ก.ย. 2569)
 *
 * เปลี่ยนชื่อ env ให้ตรงไม่ได้ เพราะบน Vercel ตั้งเป็นชนิด `sensitive` = อ่านค่ากลับ
 * ไม่ได้ ต้องไปขอคีย์ใหม่จาก console ของแต่ละเจ้าก่อน · รับทั้งสองชื่อจึงถูกกว่า
 *
 * อยู่แยกไฟล์เพราะทั้ง `auth.config.ts` (edge) และหน้าสถานะระบบ (node) ต้องใช้
 * ถ้าต่างคนต่างเขียนเงื่อนไขเอง ก็จะเพี้ยนกันอีกแบบเดิม — ไฟล์นี้อ่าน env อย่างเดียว
 * ไม่ import อะไรเลย จึงปลอดภัยทั้งสองฝั่ง
 */

export type OAuthKeys = { clientId: string; clientSecret: string };

export function oauthKeys(name: "GOOGLE" | "LINE"): OAuthKeys | null {
  const clientId = process.env[`AUTH_${name}_ID`] || process.env[`${name}_CLIENT_ID`];
  const clientSecret = process.env[`AUTH_${name}_SECRET`] || process.env[`${name}_CLIENT_SECRET`];
  // ต้องครบคู่ — มีแต่ id แล้วเปิด provider จะได้ปุ่มที่กดแล้วพัง ซึ่งแย่กว่าไม่มีปุ่ม
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** ชื่อผู้ให้บริการที่เปิดใช้ได้จริงตอนนี้ — หน้าสถานะระบบใช้รายงาน */
export function enabledOAuthProviders(): string[] {
  return [
    oauthKeys("GOOGLE") && "Google",
    oauthKeys("LINE") && "LINE",
  ].filter((v): v is string => typeof v === "string");
}
