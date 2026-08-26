import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * ชุด UAT — ต่างจาก `npm test` ตรงที่ตัวนี้ "ชนฐานข้อมูลจริง"
 * เรียกฟังก์ชันเดียวกับที่เว็บใช้ ไม่ใช่ของจำลอง
 * ต้องชี้ DATABASE_URL ไปฐานข้อมูลทดสอบเท่านั้น
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["uat/**/*.uat.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    // ด่านกันชน production — ทำงานก่อนไฟล์ UAT ทุกไฟล์
    globalSetup: ["./uat/guard.ts"],
  },
});
