/**
 * สำรวจค่า status จริงในฐานข้อมูล ก่อนตัดสินใจแปลงเป็น enum
 *
 * ทำไมต้องมี: enum ของ Postgres ต้องครอบคลุมค่าที่มีอยู่ทุกแถว ถ้ามีค่าที่ไม่รู้จัก
 * หลงเหลืออยู่แม้แถวเดียว `prisma migrate deploy` จะล้ม แล้ว deploy ทั้งเว็บพังตาม
 * สคริปต์นี้บอกล่วงหน้าว่าปลอดภัยหรือยัง — ใช้ Prisma ที่มีอยู่ ไม่ต้องติดตั้ง psql
 *
 * ดูฐานข้อมูล production:
 *   npx vercel env pull .env.production.local --environment=production
 *   npm run db:status-audit -- .env.production.local
 *   del .env.production.local          <- ลบทิ้งทุกครั้ง อย่าเก็บรหัสไว้ในเครื่อง
 *
 * ดูฐานข้อมูลในเครื่อง (ต้องเปิด Docker ก่อน):
 *   npm run db:status-audit
 */
import { readFileSync } from "node:fs";

const envFile = process.argv[2];
if (envFile) {
  // อ่านไฟล์ env เอง โปรเจกต์ไม่ได้ลง dotenv ไว้
  for (const rawLine of readFileSync(envFile, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // ตัดเครื่องหมายคำพูดเฉพาะที่ครอบทั้งค่า ไม่ใช่ที่อยู่กลางค่า
    const q = val[0];
    if (val.length > 1 && (q === '"' || q === "'") && val[val.length - 1] === q) {
      val = val.slice(1, -1);
    }
    // ไฟล์ที่ส่งมาทางอาร์กิวเมนต์ต้องชนะ env ที่ค้างใน shell ไม่งั้นจะงงว่าต่อฐานไหน
    process.env[key] = val;
  }
  // Vercel เก็บ connection string ไว้หลายชื่อแล้วแต่ผู้ให้บริการ (Neon/Supabase/Vercel Postgres)
  // ถ้าไม่มี DATABASE_URL ให้ลองชื่ออื่นที่พบบ่อย ก่อนจะยอมแพ้
  if (!process.env.DATABASE_URL) {
    const alt = ["POSTGRES_PRISMA_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DIRECT_URL"]
      .find((k) => process.env[k]);
    if (alt) {
      process.env.DATABASE_URL = process.env[alt];
      console.log(`ไม่พบ DATABASE_URL ใช้ ${alt} แทน`);
    } else {
      console.log("คีย์ที่มีในไฟล์:", Object.keys(process.env).filter((k) => /URL|POSTGRES|DB/i.test(k)).join(", ") || "(ไม่พบคีย์ที่เกี่ยวกับฐานข้อมูลเลย)");
    }
  }
  console.log(`อ่าน env จาก ${envFile}`);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

/**
 * ค่าที่โค้ดประกาศไว้ — คัดลอกมาจาก src/config/status.ts
 * ⚠️ แก้ที่นั่นแล้วต้องแก้ที่นี่ด้วย (สคริปต์เป็น .mjs จึง import จาก .ts ตรง ๆ ไม่ได้)
 */
const DECLARED = {
  Subscription: ["ACTIVE", "TRIALING", "INACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"],
  Payment: ["paid"],
  AccessGrant: ["PENDING", "GRANTED", "REVOKED", "PENDING_REVOKE"],
  TelegramGrant: ["PENDING", "ADDED", "REMOVED", "PENDING_REMOVE"],
  SlipOrder: ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"],
};

const TABLES = [
  ["Subscription", () => prisma.subscription.groupBy({ by: ["status"], _count: true })],
  ["Payment", () => prisma.payment.groupBy({ by: ["status"], _count: true })],
  ["AccessGrant", () => prisma.accessGrant.groupBy({ by: ["status"], _count: true })],
  ["TelegramGrant", () => prisma.telegramGrant.groupBy({ by: ["status"], _count: true })],
  ["SlipOrder", () => prisma.slipOrder.groupBy({ by: ["status"], _count: true })],
];

function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "(อ่าน DATABASE_URL ไม่ได้)";
  }
}

async function main() {
  console.log(`\nฐานข้อมูล: ${dbHost()}\n`);
  let unknown = 0;

  for (const [name, run] of TABLES) {
    const rows = await run();
    console.log(name);
    if (rows.length === 0) console.log("  (ไม่มีข้อมูล)");
    for (const r of rows) {
      const ok = DECLARED[name].includes(r.status);
      if (!ok) unknown++;
      console.log(`  ${ok ? "ok " : "!! "}${String(r.status).padEnd(18)} ${r._count} แถว`);
    }
    console.log("");
  }

  const roles = await prisma.user.groupBy({ by: ["role"], _count: true });
  console.log("User.role");
  for (const r of roles) {
    const ok = ["USER", "ADMIN"].includes(r.role);
    if (!ok) unknown++;
    console.log(`  ${ok ? "ok " : "!! "}${String(r.role).padEnd(18)} ${r._count} แถว`);
  }

  console.log("");
  console.log(
    unknown === 0
      ? "ไม่มีค่าที่โค้ดไม่รู้จัก — แปลงเป็น enum ได้ปลอดภัย"
      : `พบค่าที่โค้ดไม่รู้จัก ${unknown} แบบ (บรรทัด !!) ต้องจัดการก่อน ไม่งั้น migrate ล้มแล้ว deploy พัง`
  );
  console.log("");
}

main()
  .catch((e) => {
    console.error("\nอ่านฐานข้อมูลไม่สำเร็จ:", e.message);
    console.error("ถ้าเป็นฐานข้อมูลในเครื่อง ต้องเปิด Docker ก่อน");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
