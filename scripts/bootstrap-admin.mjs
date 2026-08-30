#!/usr/bin/env node
/**
 * สร้าง/อัปเดตบัญชีแอดมินตอน deploy จากค่าใน env
 *
 * ทำไมต้องมีทั้งที่มี scripts/admin.mjs อยู่แล้ว:
 * ตัวนั้นบังคับให้พิมพ์รหัสผ่านในเทอร์มินัลจริง (ต้องมี TTY) ซึ่งใช้บน Vercel ไม่ได้
 * และเจ้าของเว็บเข้า console ของ Neon ไม่ได้ จึงไม่มีทางแตะฐานข้อมูล production เลย
 * ตัวนี้อาศัยจังหวะ build บน Vercel ซึ่งมี DATABASE_URL ของ production อยู่แล้ว
 *
 * ไม่ตั้ง env = ข้ามไปเงียบ ๆ ทำให้ build ปกติไม่ได้รับผลกระทบ
 *   ADMIN_BOOTSTRAP_USERNAME  ชื่อผู้ใช้ (บังคับ)
 *   ADMIN_BOOTSTRAP_PASSWORD  รหัสผ่าน (บังคับ, อย่างน้อย 8 ตัว)
 *   ADMIN_BOOTSTRAP_EMAIL     อีเมล (ไม่บังคับ — ใส่ไว้จะรีเซ็ตรหัสผ่านทางอีเมลได้)
 *
 * ⚠️ ลบ ADMIN_BOOTSTRAP_PASSWORD ออกจาก Vercel หลังใช้เสร็จ
 *    ไม่งั้นรหัสผ่านจะถูกเขียนทับกลับทุกครั้งที่ deploy แม้เจ้าของจะเปลี่ยนรหัสไปแล้ว
 *
 * ห้ามพิมพ์รหัสผ่านออก log เด็ดขาด — log ของ build เก็บไว้และเปิดดูย้อนหลังได้
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const MIN_PASSWORD = 8;

const username = (process.env.ADMIN_BOOTSTRAP_USERNAME ?? "").trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase() || null;

if (!username || !password) {
  console.log("bootstrap-admin: ไม่ได้ตั้ง env — ข้าม");
  process.exit(0);
}

if (password.length < MIN_PASSWORD) {
  console.error(`bootstrap-admin: รหัสผ่านสั้นกว่า ${MIN_PASSWORD} ตัวอักษร — ยกเลิก`);
  process.exit(1);
}

// ตัวพิมพ์เล็ก ตัวเลข ขีดล่าง จุด เท่านั้น กัน username ที่มี @ ไปชนกับการตรวจว่าเป็นอีเมล
if (!/^[a-z0-9_.]{3,32}$/.test(username)) {
  console.error("bootstrap-admin: ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ . ยาว 3-32 ตัว — ยกเลิก");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 10);

  // หาบัญชีเดิมจาก username ก่อน ถ้าไม่มีค่อยดูจากอีเมล
  // เพื่อไม่ให้สร้างบัญชีซ้ำกับคนที่เคยสมัครด้วยอีเมลเดียวกันไว้แล้ว
  const existing =
    (await prisma.user.findUnique({ where: { username } })) ??
    (email ? await prisma.user.findUnique({ where: { email } }) : null);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { username, passwordHash, role: "ADMIN", ...(email ? { email } : {}) },
    });
    console.log(`bootstrap-admin: อัปเดตบัญชีเดิมเป็นแอดมินแล้ว (${username})`);
  } else {
    await prisma.user.create({
      data: { username, email, passwordHash, role: "ADMIN", name: username },
    });
    console.log(`bootstrap-admin: สร้างบัญชีแอดมินใหม่แล้ว (${username})`);
  }
} catch (e) {
  // build ต้องไม่ล้มเพราะเรื่องนี้ ไม่งั้นเว็บทั้งเว็บ deploy ไม่ขึ้น
  console.error("bootstrap-admin: ล้มเหลว —", e instanceof Error ? e.message : e);
} finally {
  await prisma.$disconnect();
}
