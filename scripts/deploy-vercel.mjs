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
 *
 * และอัปโหลดเฉพาะไฟล์ที่ Vercel ยังไม่มี (ถามจาก sha) — ดูเหตุผลที่ createDeployment
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

/** บรรทัด "ปลดล็อกเมื่อไหร่" ของโควตา — เว้นไว้เมื่อ Vercel ไม่ได้บอกเวลามา */
const unlockLine = (json) => {
  const reset = json?.error?.limit?.reset;
  if (!reset) return "";
  return `ปลดล็อก ${new Date(reset).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} (เวลาไทย)\n`;
};

/**
 * แปลงคำตอบที่ไม่ผ่านให้เป็นข้อความที่อ่านรู้เรื่อง — คืน null เมื่ออธิบายไม่ได้
 *
 * แยกออกมาจาก api() เพราะการสร้าง deployment ใช้ { raw: true } เพื่ออ่านรายชื่อไฟล์ที่ขาด
 * เลยไม่ผ่านด่านนี้ และเคยพ่น JSON ดิบของโควตาเต็มออกมาแทนคำอธิบาย
 */
const explain = (status, json, body = "") => {
  // 401/403 เกือบทุกครั้งแปลว่า token ถูกเพิกถอนหรือหมดอายุ ไม่ใช่โค้ดมีปัญหา
  // ถ้าไม่ดักตรงนี้ จะได้ JSON ดิบยาว ๆ ที่อ่านแล้วนึกว่า deploy พัง
  if (status === 401 || status === 403) {
    return (
      `token ใช้ไม่ได้แล้ว (HTTP ${status}) — โดนเพิกถอนหรือหมดอายุ\n\n` +
      `ออก token ใหม่ที่ https://vercel.com/account/tokens (scope: tradepulse)\n` +
      `แล้วรันในโฟลเดอร์โปรเจกต์:\n` +
      `  pbpaste > .vercel-token && chmod 600 .vercel-token && gh secret set VERCEL_TOKEN < .vercel-token\n\n` +
      `เว็บที่รันอยู่ไม่ได้รับผลกระทบ — deployment เดิมยังเสิร์ฟตามปกติ\n` +
      `คำตอบจาก Vercel: ${body.slice(0, 300)}`
    );
  }

  // แพ็กเกจฟรีจำกัด deployment 100 ครั้ง / 24 ชม. — คนละโควตากับจำนวนไฟล์
  // เจอจริง 30 ก.ย. 69 หลัง deploy ถี่มากทั้งคืน เว็บที่รันอยู่ไม่กระทบ
  if (status === 402) {
    return (
      `Vercel จำกัดจำนวน deployment (HTTP 402) — แพ็กเกจฟรี 100 ครั้ง / 24 ชม. เต็มแล้ว\n` +
      unlockLine(json) +
      `\nเว็บที่รันอยู่ไม่ได้รับผลกระทบ — deployment เดิมยังเสิร์ฟตามปกติ\n` +
      `โค้ดขึ้น GitHub แล้ว แค่ยังไม่ได้ deploy ต้องรันซ้ำหลังปลดล็อก`
    );
  }

  // โควตาอัปโหลดของแพ็กเกจฟรีคือ 5000 ไฟล์ / 24 ชม. — บอกเวลาที่ปลดล็อกไปเลย
  // ไม่ต้องให้ไปเปิดเอกสารหาเอง และย้ำว่าเว็บที่รันอยู่ไม่กระทบ
  if (status === 429) {
    return (
      `Vercel จำกัดจำนวนอัปโหลด (HTTP 429) — โควตาแพ็กเกจฟรี 5000 ไฟล์ / 24 ชม. เต็มแล้ว\n` +
      unlockLine(json) +
      `\nเว็บที่รันอยู่ไม่ได้รับผลกระทบ — deployment เดิมยังเสิร์ฟตามปกติ\n` +
      `แค่ commit ล่าสุดยังไม่ขึ้น ต้องรัน deploy ซ้ำหลังปลดล็อก`
    );
  }

  return null;
};

/**
 * เรียก API — โยน error ที่อ่านรู้เรื่องเมื่อไม่ผ่าน
 *
 * ส่ง { raw: true } มาเมื่ออยากอ่านคำตอบตอนพลาดเอง (ใช้ตอนถาม Vercel ว่าขาดไฟล์ไหน)
 */
const api = async (path, init = {}) => {
  const { raw, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { authorization: `Bearer ${token}`, ...rest.headers },
  });
  const body = await res.text();
  const json = body ? JSON.parse(body) : null;
  if (raw) return { ok: res.ok, status: res.status, json, body };
  if (!res.ok) {
    const why = explain(res.status, json, body);
    if (why) throw new Error(why);
    throw new Error(`${rest.method || "GET"} ${path} → ${res.status}\n${body}`);
  }
  return json;
};

// token แบบ vcp_ ผูกกับโปรเจกต์เดียว จึงอ่าน id ของตัวเองได้โดยไม่ต้องแตะ endpoint ของทีม
const projectName = process.env.VERCEL_PROJECT || "tradepulse";
const project = await api(`/v9/projects/${projectName}`);
console.log(`โปรเจกต์ ${project.name} (${project.id})`);

const paths = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);

// อ่านไฟล์ + คิด sha ไว้ก่อน ยังไม่อัปอะไร
const files = [];
const blobs = new Map(); // sha -> เนื้อไฟล์
for (const file of paths) {
  const data = await readFile(file);
  const sha = createHash("sha1").update(data).digest("hex");
  files.push({ file, sha, size: data.length });
  blobs.set(sha, data);
}
console.log(`ไฟล์ในรีโป ${files.length} ไฟล์`);

/**
 * สร้าง deployment — ถ้า Vercel ยังไม่มีไฟล์ไหน จะตอบ 400 พร้อมรายชื่อ sha ที่ขาด
 *
 * ⚠️ ห้ามอัปโหลดทุกไฟล์ทุกครั้ง (โค้ดเดิมทำแบบนั้น)
 *    Vercel เก็บไฟล์ไว้ตาม sha อยู่แล้ว ไฟล์ที่ไม่ได้แก้จึงไม่ต้องส่งซ้ำ
 *    การส่งซ้ำทั้ง 495 ไฟล์ทำให้โควตาฟรี 5000 ไฟล์/24ชม. หมดใน ~10 deploy
 *    (เกิดขึ้นจริงวันที่ 29 ก.ย. 69 — deploy ค้างไปหนึ่งวันเต็ม)
 *    ปกติ deploy หนึ่งครั้งจะอัปแค่ไฟล์ที่เปลี่ยน ไม่กี่ใบ
 */
const createDeployment = async () =>
  api(`/v13/deployments?projectId=${project.id}`, {
    method: "POST",
    raw: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      files,
      target: "production",
      projectSettings: { framework: "nextjs" },
    }),
  });

/** sha ที่ Vercel บอกว่ายังไม่มี — รูปแบบคำตอบต่างกันตามเวอร์ชัน API จึงรับหลายทาง */
const missingShas = (res) => {
  const e = res.json?.error ?? {};
  const list = e.missing ?? res.json?.missing ?? [];
  return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
};

const byName = new Map(files.map((f) => [f.sha, f.file]));

// ลองสร้าง -> อัปไฟล์ที่ขาด -> ลองใหม่ วนได้ไม่เกิน 3 รอบ
// เผื่อ Vercel ตอบรายชื่อที่ขาดมาไม่ครบในรอบเดียว แต่ก็ไม่วนไม่จบถ้ามันขอซ้ำ
let res = await createDeployment();
for (let round = 1; !res.ok && round <= 3; round++) {
  const missing = missingShas(res);
  if (missing.length === 0) {
    throw new Error(explain(res.status, res.json) ?? `POST /v13/deployments → ${res.status}\n${res.body}`);
  }

  console.log(
    `Vercel มีไฟล์เดิมอยู่แล้ว ${files.length - missing.length} ไฟล์ — อัปเฉพาะที่เปลี่ยน ${missing.length} ไฟล์`,
  );
  for (const sha of missing) {
    const data = blobs.get(sha);
    if (!data) throw new Error(`Vercel ขอ sha ${sha} ที่ไม่ได้อยู่ในรีโป`);
    console.log(`  ↑ ${byName.get(sha)}`);
    await api("/v2/files", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-vercel-digest": sha,
        "content-length": String(data.length),
      },
      body: data,
    });
  }
  res = await createDeployment();
}
if (!res.ok) throw new Error(`POST /v13/deployments → ${res.status}\n${res.body}`);

const deployment = res.json;

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
