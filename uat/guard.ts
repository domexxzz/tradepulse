/**
 * ด่านกัน UAT ชนฐานข้อมูลจริง
 *
 * ชุด UAT เรียก runMembershipMaintenance() ซึ่งทำงานกับ "ทุกแถว" ในฐานข้อมูล
 * ไม่ได้จำกัดเฉพาะข้อมูลทดสอบ ถ้าเผลอชี้ DATABASE_URL ไป production
 * มันจะปิดสิทธิ์สมาชิกจริงที่เลยวันหมดอายุและเข้าคิวถอนสิทธิ์ทันที
 *
 * เดิมมีแต่คำเตือนในคู่มือ ซึ่งพิมพ์ผิดทีเดียวก็พลาดได้ จึงบังคับด้วยโค้ดแทน
 * ไฟล์นี้ถูกเรียกเป็น globalSetup ของ vitest.uat.mts จึงครอบไฟล์ UAT ทุกไฟล์
 * รวมถึงไฟล์ที่จะเพิ่มในอนาคตโดยไม่ต้องจำไปใส่เอง
 *
 * ต้องอ่าน .env เองก่อนตรวจ — globalSetup ทำงานก่อนใครทั้งหมด
 * ส่วน Prisma โหลด .env ตอนสร้าง client ซึ่งเกิดทีหลัง ถ้าไม่อ่านเองตรงนี้
 * ด่านจะเห็น DATABASE_URL ว่างเปล่าแล้วบล็อกทุกครั้ง แม้ตั้งค่าไว้ถูกต้องแล้ว
 * (อ่านเองแทนใช้ dotenv เพราะโปรเจกต์ไม่ได้ประกาศไว้เป็น dependency
 *  และ scripts/ ตัวอื่นก็ใช้วิธีนี้อยู่แล้ว)
 */
import { readFileSync } from "node:fs";

function loadEnvFiles() {
  // .env.local ทับ .env ตามลำดับเดียวกับที่ Next.js ใช้
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
        // ค่าที่ตั้งมาจากเชลล์ชนะไฟล์เสมอ — เผื่อ CI ส่งมาทาง env จริง ๆ
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {
      // ไม่มีไฟล์ก็ไม่เป็นไร ตัวตรวจข้างล่างจะบอกเองว่าไม่มี DATABASE_URL
    }
  }
}

/** ยอมให้รันเฉพาะฐานข้อมูลที่ชื่อหรือโฮสต์บ่งชี้ว่าเป็นของทดสอบ */
const SAFE = /(^|[^a-z])(uat|test)([^a-z]|$)|localhost|127\.0\.0\.1|host\.docker\.internal/i;

export function setup() {
  loadEnvFiles();
  const url = process.env.DATABASE_URL ?? "";

  if (!url) {
    throw new Error("UAT: ไม่ได้ตั้ง DATABASE_URL — ดูวิธีตั้งฐานข้อมูลทดสอบใน docs/SETUP.md");
  }

  if (!SAFE.test(url)) {
    // ตัดรหัสผ่านออกก่อนพิมพ์ ไม่ให้ความลับหลุดลง log
    const shown = url.replace(/\/\/[^@]*@/, "//***@");
    throw new Error(
      "UAT ถูกยกเลิก — DATABASE_URL ไม่ได้ชี้ไปฐานข้อมูลทดสอบ\n" +
        `  ที่ตั้งไว้: ${shown}\n` +
        "  ชุดนี้แก้ข้อมูลจริงและปิดสิทธิ์สมาชิกที่หมดอายุทั้งฐานข้อมูล\n" +
        "  ใช้ฐานข้อมูลที่ชื่อมี uat หรือ test หรือรันบน localhost เท่านั้น"
    );
  }
}
