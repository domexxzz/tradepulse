#!/usr/bin/env node
/**
 * ตั้งเครื่องให้พร้อมพัฒนาด้วยคำสั่งเดียว — `npm run setup`
 *
 * มีไว้เพื่อให้คนที่เพิ่งโคลนโปรเจกต์มารันได้เลย ไม่ต้องไล่อ่าน docs ทีละขั้น
 * ทำงานได้ทั้ง macOS/Linux/Windows เพราะเขียนเป็น Node ไม่ใช่ shell script
 *
 * ทำ 4 อย่าง: หา Postgres ที่รันอยู่ → เขียน .env ให้ถ้ายังไม่มี →
 * สร้างตาราง → ใส่ข้อมูลตั้งต้น  ทุกขั้นบอกชัดว่าทำอะไรและถ้าพังต้องแก้ยังไง
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";

/**
 * ใช้ .env ไม่ใช่ .env.local เพราะ Prisma CLI อ่านแค่ .env
 * ถ้าเขียนลง .env.local แล้วไปรัน `npx prisma migrate dev` เองจะหา DATABASE_URL ไม่เจอ
 * (Next.js อ่านทั้งสองไฟล์ จึงไม่มีปัญหาฝั่งเว็บ) — คู่มือทุกหน้าก็อ้าง .env เหมือนกัน
 */
const ENV_FILE = ".env";

/** พอร์ตที่คู่มือแนะนำไว้ทั้งสองแบบ — Homebrew ใช้ 5432, Docker compose ใช้ 5433 */
const CANDIDATE_PORTS = [5432, 5433];
const DB_NAME = "qvx_dev";

const step = (n, msg) => console.log(`\n[${n}/4] ${msg}`);
const ok = (msg) => console.log(`      ✓ ${msg}`);
const warn = (msg) => console.log(`      ! ${msg}`);

function die(msg, fix) {
  console.error(`\n✗ ${msg}`);
  if (fix) console.error(`\nวิธีแก้:\n${fix}\n`);
  process.exit(1);
}

/** เช็คว่ามีอะไรฟังอยู่ที่พอร์ตนี้ไหม โดยไม่ต้องพึ่ง client ของ postgres */
function portOpen(port, host = "127.0.0.1", timeout = 1200) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host });
    const done = (result) => {
      sock.destroy();
      resolve(result);
    };
    sock.setTimeout(timeout);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

function run(cmd, args, env = {}) {
  execFileSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
}

function readEnvValue(file, key) {
  if (!existsSync(file)) return null;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
}

async function main() {
  console.log("\nตั้งค่าเครื่องสำหรับพัฒนา QVX");

  // ── 1. หา Postgres ────────────────────────────────────────────────
  step(1, "หา PostgreSQL ที่รันอยู่");
  let port = null;
  for (const p of CANDIDATE_PORTS) {
    if (await portOpen(p)) {
      port = p;
      ok(`เจอที่พอร์ต ${p}`);
      break;
    }
  }
  if (!port) {
    die(
      `ไม่เจอ PostgreSQL ที่พอร์ต ${CANDIDATE_PORTS.join(" หรือ ")}`,
      [
        "  macOS   : brew install postgresql@16 && brew services start postgresql@16",
        "  Windows : ติดตั้งจาก https://www.postgresql.org/download/windows/",
        "  Docker  : docker run -d --name qvx-db -p 5432:5432 \\",
        "              -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=qvx_dev postgres:16",
      ].join("\n")
    );
  }

  // ── 2. เตรียมไฟล์ env ─────────────────────────────────────────────
  step(2, `เตรียม ${ENV_FILE}`);
  if (!existsSync(ENV_FILE)) {
    copyFileSync(".env.example", ENV_FILE);
    ok(`สร้าง ${ENV_FILE} จาก .env.example แล้ว`);
  } else {
    ok(`มี ${ENV_FILE} อยู่แล้ว ไม่ทับของเดิม`);
  }

  const existingUrl = readEnvValue(ENV_FILE, "DATABASE_URL");
  if (existingUrl) {
    ok(`ใช้ DATABASE_URL ที่ตั้งไว้แล้ว`);
  } else {
    // ตัวติดตั้ง Postgres บน Windows สร้าง role ชื่อ postgres มาให้ ไม่ใช่ชื่อผู้ใช้ Windows
    // ส่วน Homebrew บน mac สร้าง role ตามชื่อผู้ใช้เครื่อง
    const user =
      process.env.PGUSER ||
      (process.platform === "win32" ? "postgres" : process.env.USER || "postgres");
    const url = `postgresql://${user}@127.0.0.1:${port}/${DB_NAME}?schema=public`;
    let text = readFileSync(ENV_FILE, "utf8");
    text = text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`);
    text = text.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL="${url}"`);
    writeFileSync(ENV_FILE, text);
    ok(`ตั้ง DATABASE_URL เป็น ${DB_NAME} ที่พอร์ต ${port}`);
    warn(`ถ้า Postgres ของคุณต้องใช้รหัสผ่าน ให้ไปแก้ ${ENV_FILE} เพิ่มเอง`);
  }

  // ── 3. สร้างตาราง ─────────────────────────────────────────────────
  step(3, "สร้างตารางในฐานข้อมูล");
  const url = readEnvValue(ENV_FILE, "DATABASE_URL");
  const dbEnv = { DATABASE_URL: url, DIRECT_URL: readEnvValue(ENV_FILE, "DIRECT_URL") || url };
  try {
    run("npx", ["prisma", "generate"], dbEnv);
    run("npx", ["prisma", "migrate", "deploy"], dbEnv);
    ok("ตารางพร้อมแล้ว");
  } catch {
    die(
      "สร้างตารางไม่สำเร็จ",
      [
        `  ถ้าขึ้นว่าไม่มีฐานข้อมูล ให้สร้างก่อน:`,
        `    createdb ${DB_NAME}`,
        `  ถ้าขึ้นว่า authentication failed ให้ใส่ user/password ให้ถูกใน ${ENV_FILE}`,
      ].join("\n")
    );
  }

  // ── 4. ข้อมูลตั้งต้น ───────────────────────────────────────────────
  step(4, "ใส่ข้อมูลตั้งต้น");
  try {
    run("node", ["prisma/seed.mjs"], dbEnv);
    ok("เรียบร้อย");
  } catch {
    warn("seed ไม่ผ่าน — ข้ามไปก่อนได้ เว็บยังรันได้ปกติ");
  }

  console.log(
    [
      "",
      "พร้อมแล้ว ทำต่อได้เลย",
      "",
      "  npm run dev        เปิดเว็บที่ http://localhost:3000",
      "  npm run admin      สร้างบัญชีแอดมินเพื่อเข้าหน้าจัดการระบบ",
      "  npm test           เทสต์ตรรกะ (ไม่แตะฐานข้อมูล)",
      "  npm run test:uat   เทสต์กับฐานข้อมูลจริง",
      "",
    ].join("\n")
  );
}

main().catch((e) => die(e.message));
