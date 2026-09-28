#!/usr/bin/env node
/**
 * ดัน production ขึ้น Vercel ผ่าน REST API
 *
 * ทำไมต้องมีไฟล์นี้ แทนที่จะให้ Vercel deploy เองตอน push
 *   โปรเจกต์อยู่บนทีม Vercel ของโดม แต่คนกด merge คือเบส (electiction)
 *   Vercel เลยบล็อกทุก deploy ที่ commit author ไม่มีสิทธิ์ในโปรเจกต์
 *   ("Deployment was blocked") ทั้ง preview และ production — เช็คได้ด้วย
 *     gh api repos/domexxzz/tradepulse/deployments
 *
 *   วิธีแก้ถาวรคือเพิ่ม electiction เข้าโปรเจกต์บน Vercel (หรือย้ายโปรเจกต์
 *   มาบัญชีเบส) แล้วเลิกใช้ไฟล์นี้ได้เลย ระหว่างที่ยังไม่ได้ทำ ใช้อันนี้ไปก่อน
 *
 * ปกติไม่ต้องรันเอง — job `deploy` ใน .github/workflows/ci.yml เรียกให้อัตโนมัติ
 * ทุกครั้งที่ merge เข้า main (ใช้ repo secret VERCEL_TOKEN)
 *
 * รันเองเมื่อ Actions ล่มหรืออยากดันด่วน
 *   1. เก็บ token ไว้ในไฟล์ (อย่าพิมพ์ token ลงบรรทัดคำสั่ง เดี๋ยวติดใน history)
 *        pbpaste > .vercel-token     # copy token มาจาก Vercel ก่อน
 *        chmod 600 .vercel-token
 *   2. node scripts/deploy-vercel.mjs
 *
 * ส่งขึ้นเฉพาะไฟล์ที่ git ติดตามอยู่ (git ls-files) — .env, backup.env, mail.env
 * และไฟล์ .gitignore อื่น ๆ จึงไม่มีทางหลุดขึ้นไป ต่อให้วางอยู่ในโฟลเดอร์โปรเจกต์
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const API = "https://api.vercel.com";
const TOKEN_FILE = process.env.VERCEL_TOKEN_FILE || ".vercel-token";

const token = (process.env.VERCEL_TOKEN || (await readFile(TOKEN_FILE, "utf8").catch(() => ""))).trim();
if (!token) {
  console.error(`ไม่เจอ token — ทำตามนี้ก่อน\n  pbpaste > ${TOKEN_FILE}\n  chmod 600 ${TOKEN_FILE}`);
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
  });
  const body = await res.text();
  if (!res.ok) {
    // 401/403 เกือบทุกครั้งแปลว่า token ถูกเพิกถอนหรือหมดอายุ ไม่ใช่โค้ดมีปัญหา
    // ถ้าไม่ดักตรงนี้ จะได้ JSON ดิบยาว ๆ ที่อ่านแล้วนึกว่า deploy พัง
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `token ใช้ไม่ได้แล้ว (HTTP ${res.status}) — โดนเพิกถอนหรือหมดอายุ\n\n` +
          `ออก token ใหม่ที่ https://vercel.com/account/tokens (scope: tradepulse)\n` +
          `แล้วรันในโฟลเดอร์โปรเจกต์:\n` +
          `  pbpaste > .vercel-token && chmod 600 .vercel-token && gh secret set VERCEL_TOKEN < .vercel-token\n\n` +
          `เว็บที่รันอยู่ไม่ได้รับผลกระทบ — deployment เดิมยังเสิร์ฟตามปกติ\n` +
          `คำตอบจาก Vercel: ${body.slice(0, 300)}`,
      );
    }
    throw new Error(`${init.method || "GET"} ${path} → ${res.status}\n${body}`);
  }
  return body ? JSON.parse(body) : null;
};

// token แบบ vcp_ ผูกกับโปรเจกต์เดียว จึงอ่าน id ของตัวเองได้โดยไม่ต้องแตะ endpoint ของทีม
const projectName = process.env.VERCEL_PROJECT || "tradepulse";
const project = await api(`/v9/projects/${projectName}`);
console.log(`โปรเจกต์ ${project.name} (${project.id})`);

const paths = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
console.log(`ไฟล์ที่จะส่ง ${paths.length} ไฟล์`);

const files = [];
for (const file of paths) {
  const data = await readFile(file);
  const sha = createHash("sha1").update(data).digest("hex");
  await api("/v2/files", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-vercel-digest": sha,
      "content-length": String(data.length),
    },
    body: data,
  });
  files.push({ file, sha, size: data.length });
}
console.log("อัปโหลดครบแล้ว");

const deployment = await api(`/v13/deployments?projectId=${project.id}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: project.name,
    project: project.id,
    files,
    target: "production",
    projectSettings: { framework: "nextjs" },
  }),
});

console.log(`เริ่ม build แล้ว → https://${deployment.url}`);

// รอจนกว่าจะ READY หรือ ERROR — ไม่งั้นไม่รู้ว่า build พังหรือเปล่า
let state = deployment.readyState;
while (state === "QUEUED" || state === "BUILDING" || state === "INITIALIZING") {
  await new Promise((r) => setTimeout(r, 5000));
  ({ readyState: state } = await api(`/v13/deployments/${deployment.id}`));
  process.stdout.write(`\r  สถานะ ${state}          `);
}
console.log();

if (state !== "READY") {
  console.error(`build ไม่ผ่าน (${state}) — ดู log ที่ https://${deployment.url}`);
  process.exit(1);
}
console.log("ขึ้น production เรียบร้อย");
