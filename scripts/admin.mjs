#!/usr/bin/env node
/**
 * ตั้ง/รีเซ็ตบัญชีแอดมิน โดยไม่ต้องพึ่งอีเมล
 *
 * มีไว้เพราะ "ลืมรหัสผ่าน?" บนหน้าเว็บใช้ไม่ได้ถ้ายังไม่ได้ตั้ง RESEND_API_KEY
 * ถ้าเจ้าของเว็บจำรหัสไม่ได้ก็จะเข้าหลังบ้านไม่ได้เลย
 *
 * รหัสผ่านพิมพ์ตอนรัน ไม่โชว์บนจอ ไม่รับผ่าน argument (จะไปติดใน shell history)
 * และไม่ถูกพิมพ์ออก log ที่ไหนทั้งสิ้น — เก็บลงฐานข้อมูลเป็น bcrypt hash เท่านั้น
 *
 *   npm run admin                                  # ใช้ DATABASE_URL ที่ตั้งอยู่
 *   DATABASE_URL="postgresql://…" npm run admin    # ชี้ไปฐานข้อมูลอื่น
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline";

const MIN_PASSWORD = 8;

const KEY_ENTER = ["\r", "\n", "\u0004"];   // Enter หรือ Ctrl+D
const KEY_INTERRUPT = "\u0003";            // Ctrl+C
const KEY_BACKSPACE = ["\u007f", "\b"];         // Backspace

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

/** พิมพ์รหัสผ่านโดยไม่ให้ตัวอักษรขึ้นจอ */
function askSecret(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("ต้องรันในเทอร์มินัลจริง ไม่งั้นรหัสผ่านจะโผล่บนจอ"));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    let done = false;

    const finish = () => {
      done = true;
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      resolve(value);
    };

    // raw mode ส่งข้อมูลมาเป็นก้อน ไม่ใช่ทีละตัว — วางรหัสผ่านจาก password manager
    // จะมาทั้งสตริงพร้อม newline ในครั้งเดียว ต้องไล่ทีละอักขระ ไม่งั้นค้างไม่มีวันจบ
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (done) return;
        if (KEY_ENTER.includes(ch)) return finish();
        if (ch === KEY_INTERRUPT) {
          stdin.setRawMode(false);
          stdout.write("\nยกเลิก\n");
          process.exit(130);
        }
        if (KEY_BACKSPACE.includes(ch)) {
          value = value.slice(0, -1);
          continue;
        }
        if (ch >= " ") value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/** โชว์ปลายทางให้เห็นก่อนเขียน แต่ไม่โชว์รหัสผ่านของฐานข้อมูล */
function describeTarget(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`;
  } catch {
    return "(อ่าน DATABASE_URL ไม่ออก)";
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ยังไม่ได้ตั้ง DATABASE_URL — ตั้งก่อนแล้วรันใหม่");
    process.exit(1);
  }

  console.log(`\nฐานข้อมูลปลายทาง: ${describeTarget(url)}\n`);
  const go = await ask("ใช่ฐานข้อมูลที่ต้องการแก้ไหม? พิมพ์ yes เพื่อไปต่อ: ");
  if (go.toLowerCase() !== "yes") {
    console.log("ยกเลิก ไม่ได้แตะข้อมูลอะไร");
    process.exit(0);
  }

  const email = (await ask("อีเมลแอดมิน: ")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("อีเมลไม่ถูกต้อง");
    process.exit(1);
  }

  const password = await askSecret(`รหัสผ่านใหม่ (อย่างน้อย ${MIN_PASSWORD} ตัว ไม่โชว์บนจอ): `);
  if (password.length < MIN_PASSWORD) {
    console.error(`รหัสผ่านสั้นไป ต้องอย่างน้อย ${MIN_PASSWORD} ตัว`);
    process.exit(1);
  }
  const confirm = await askSecret("พิมพ์รหัสผ่านซ้ำอีกครั้ง: ");
  if (password !== confirm) {
    console.error("รหัสผ่านสองครั้งไม่ตรงกัน");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    const user = existing
      ? await prisma.user.update({
          where: { email },
          data: { passwordHash, role: "ADMIN" },
          select: { id: true, email: true, role: true },
        })
      : await prisma.user.create({
          data: { email, name: "แอดมิน", passwordHash, role: "ADMIN" },
          select: { id: true, email: true, role: true },
        });

    // ตั๋วรีเซ็ตรหัสเก่าที่ยังค้างอยู่ต้องใช้ไม่ได้แล้ว
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    console.log(`\n${existing ? "อัปเดตบัญชีเดิม" : "สร้างบัญชีใหม่"}แล้ว`);
    console.log(`  อีเมล : ${user.email}`);
    console.log(`  สิทธิ์ : ${user.role}`);
    console.log(`\nล็อกอินที่ /login ด้วยรหัสที่เพิ่งตั้ง แล้วเมนู "จัดการระบบ" จะขึ้นในหน้าบัญชี\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nล้มเหลว:", e.message);
  process.exit(1);
});
