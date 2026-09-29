#!/usr/bin/env node
/**
 * ตั้งค่า env บน Vercel จาก "ไฟล์" ไม่ใช่จากบรรทัดคำสั่ง
 *
 * ทำไมต้องอ่านจากไฟล์: ค่าที่พิมพ์ลงบรรทัดคำสั่งจะติดอยู่ใน shell history
 * และโผล่ใน ps ของทุกโปรเซสบนเครื่อง ความลับจึงไม่ควรผ่านทางนั้น
 * วิธีใช้คือก๊อปค่ามาแล้ว
 *   pbpaste > .secret && chmod 600 .secret
 *   node scripts/set-vercel-env.mjs DISCORD_CLIENT_SECRET .secret
 *   rm .secret
 *
 * สคริปต์นี้ไม่พิมพ์ค่าออกมาเลย บอกแค่ความยาวกับผลลัพธ์
 */
import { readFile } from "node:fs/promises";

const [key, file] = process.argv.slice(2);
if (!key || !file) {
  console.error("ใช้: node scripts/set-vercel-env.mjs <ชื่อ ENV> <ไฟล์ที่เก็บค่า>");
  process.exit(1);
}

const token = (process.env.VERCEL_TOKEN || (await readFile(".vercel-token", "utf8").catch(() => ""))).trim();
if (!token) {
  console.error("ไม่เจอ token — pbpaste > .vercel-token && chmod 600 .vercel-token");
  process.exit(1);
}

const value = (await readFile(file, "utf8")).trim();
if (!value) {
  console.error(`ไฟล์ ${file} ว่าง — ก๊อปค่ามาใหม่แล้วรัน pbpaste > ${file} อีกครั้ง`);
  process.exit(1);
}

// ดักความผิดพลาดที่เจอบ่อย: ก๊อปผิดของ แล้วได้ URL หรือทั้งบรรทัด KEY=value มาแทน
if (value.startsWith("http")) {
  console.error("ค่าที่ได้ขึ้นต้นด้วย http — น่าจะก๊อป URL มาผิด ลองก๊อปใหม่");
  process.exit(1);
}
if (value.includes("=") && /^[A-Z_]+=/.test(value)) {
  console.error("ค่าที่ได้มีรูปแบบ KEY=value — ก๊อปมาเกิน เอาเฉพาะค่าหลัง = พอ");
  process.exit(1);
}
if (/\s/.test(value)) {
  console.error("ค่าที่ได้มีช่องว่างอยู่ข้างใน — น่าจะก๊อปเกินมา ลองก๊อปใหม่");
  process.exit(1);
}

const projectId = process.env.VERCEL_PROJECT_ID || "prj_Ei4cxqF4VNBrA7wu61N4XPghFfah";
const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
});

if (!res.ok) {
  console.error(`ตั้งค่าไม่สำเร็จ (HTTP ${res.status})\n${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`ตั้ง ${key} บน Vercel แล้ว (ความยาว ${value.length} ตัวอักษร — ไม่แสดงค่า)`);
console.log("ขั้นต่อไป: ลบไฟล์ทิ้ง แล้ว deploy ใหม่หนึ่งครั้งให้ค่าใหม่มีผล");
