import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";
import { emailConfigStatus, emailEnabled } from "@/lib/email";

/**
 * จับงานประจำที่ "หยุดไปเงียบ ๆ"
 *
 * ระบบแจ้งเตือนที่เตือนแค่ตอนพังมีรูใหญ่: ถ้างานไม่ได้รันเลย — เครื่องปิด,
 * งานตั้งเวลาถูกปิด, สคริปต์หาย, ไฟดับยาว — จะไม่มีใครส่งอะไรมา ความเงียบจึงดู
 * เหมือนว่าทุกอย่างปกติ ซึ่งเป็นตอนที่อันตรายที่สุด เพราะจะรู้ตัวก็ตอนที่ต้องใช้ของ
 * ที่ไม่มีอยู่แล้ว
 *
 * วิธีแก้คือกลับด้าน: ให้งานรายงานตอน "สำเร็จ" เข้ามาเก็บไว้ แล้วให้ cron รายวัน
 * เป็นคนทักเองว่าเงียบไปนานแล้ว
 */

/** งานที่ต้องเฝ้า — เพิ่มงานใหม่ที่นี่ที่เดียว */
export const WATCHED_JOBS = [
  {
    name: "db-backup",
    label: "สำรองฐานข้อมูล (คอมเฟิร์ส)",
    /**
     * เงียบเกินกี่ชั่วโมงถือว่าผิดปกติ
     *
     * งานสำรองรันทุกวัน 03:00 และ cron นี้รัน 08:00 (เวลาไทย) — วันปกติห่างกัน 5 ชม.
     * ถ้าพลาดไปวันเดียวจะห่าง 29 ชม. ตั้ง 26 จึงจับการพลาดครั้งเดียวได้
     * โดยไม่เตือนพลาดเวลางานรันช้าไปหน่อย
     */
    staleHours: 26,
    /**
     * บอกวิธีแก้ไปเลย ไม่ใช่แค่บอกว่ามีปัญหา
     *
     * และต้องเป็นวิธีแก้ของ "สาเหตุที่รู้อยู่" ไม่ใช่รายการตรวจทั่วไป
     * ของเดิมสั่งให้ไปเช็กว่าเปิดเครื่องไว้ไหม ซึ่งไม่ใช่ปัญหาเลยสักครั้ง
     * สาเหตุจริงที่เจอ 3 พ.ย. 69 มีสามชั้นซ้อนกัน แก้ไปแล้วสองชั้น
     * (ipAllowList ใน render.yaml · channel_binding ใน backup.env)
     * เหลือชั้นที่สาม: รหัสถูกหมุนตอน 20 ต.ค. role qvx ถูกปิด login
     */
    howToFix: [
      "เอา External Database URL จาก Render dashboard → qvx-db → Connections",
      "รันบนคอมเฟิร์ส: powershell -ExecutionPolicy Bypass -File C:\\QVXBackup\\set-db-url.ps1 แล้ววาง URL (มันลองต่อก่อนค่อยเขียนทับ และสำรองไฟล์เดิมให้)",
      "ถ้ายังพัง ดูข้อความเต็มที่ C:\\QVXBackup\\backup.log — ถ้าขึ้น 'SSL connection has been closed unexpectedly' แปลว่า IP เครื่องเปลี่ยน ให้เอา IP ที่แนบมาในข้อความนี้ไปใส่ ipAllowList ใน render.yaml",
    ],
  },
] as const;

/**
 * ชื่อระเบียนของ "ความพยายามล่าสุด" ของงานหนึ่ง ๆ
 *
 * แยกจากระเบียนความสำเร็จโดยตั้งใจ: สองอย่างนี้ตอบคนละคำถาม
 * "สำเร็จล่าสุดเมื่อไหร่" = ข้อมูลยังย้อนได้ถึงเมื่อไหร่
 * "พยายามล่าสุดเมื่อไหร่" = งานยังถูกเรียกอยู่ไหม
 * ถ้ามีแค่อย่างแรก จะแยกไม่ออกเลยระหว่าง "ไม่ได้รัน" กับ "รันแล้วพังทุกครั้ง"
 */
export const attemptKey = (name: string) => `${name}:attempt`;

/** บันทึกว่างานนี้รันสำเร็จแล้ว */
export async function recordHeartbeat(name: string, detail?: string): Promise<void> {
  const now = new Date();
  await prisma.systemHeartbeat.upsert({
    where: { name },
    create: { name, lastSeenAt: now, detail: detail ?? null },
    update: { lastSeenAt: now, detail: detail ?? null },
  });
}

export interface StaleJob {
  name: string;
  label: string;
  hoursSilent: number | null;
}

/**
 * ตรวจงานที่เฝ้าไว้ทั้งหมด แจ้งเตือนตัวที่เงียบนานเกินกำหนด
 *
 * เตือนซ้ำได้ทุกวันโดยตั้งใจ — ต่างจากอีเมลเตือนลูกค้าที่ยิงซ้ำคือ noise
 * อันนี้ยิ่งเงียบนานยิ่งต้องดัง เพราะหมายถึงยังไม่มีใครไปแก้
 */
/** ตัดข้อความยาว — Telegram รับ 4096 ตัว และ log ยาวไม่ได้ช่วยให้อ่านง่ายขึ้น */
const clampDetail = (t: string) => (t.length > 300 ? `${t.slice(0, 300)}…` : t);

export async function checkStaleJobs(): Promise<StaleJob[]> {
  const rows = await prisma.systemHeartbeat.findMany({
    where: {
      name: { in: WATCHED_JOBS.flatMap((j) => [j.name, attemptKey(j.name)]) },
    },
  });
  const seen = new Map(rows.map((r) => [r.name, r.lastSeenAt]));
  const attempts = new Map(rows.map((r) => [r.name, r]));
  const now = Date.now();
  const stale: StaleJob[] = [];

  for (const job of WATCHED_JOBS) {
    const last = seen.get(job.name);

    // ยังไม่เคยรายงานเข้ามาเลย — อาจเพิ่งเปิดระบบนี้ อย่าเตือนจนกว่าจะเคยเห็นครั้งแรก
    // ไม่งั้นจะเตือนทุกวันตั้งแต่วันแรกก่อนที่ใครจะได้ตั้งค่า
    if (!last) continue;

    const hours = (now - last.getTime()) / 36e5;
    if (hours <= job.staleHours) continue;

    stale.push({ name: job.name, label: job.label, hoursSilent: Math.round(hours) });

    /**
     * บอกให้ตรงว่า "ไม่ได้รัน" หรือ "รันแล้วพัง" — สองอย่างนี้ต้องแก้คนละทาง
     *
     * ข้อความเดิมบอกเสมอว่า "ไม่มีข้อความว่าล้มเหลว = ไม่ได้รันเลย" ซึ่งเป็นคำยืนยัน
     * ที่ระบบไม่มีข้อมูลพอจะพูด และวันที่ 3 พ.ย. 69 ก็พูดผิดจริง ๆ —
     * งานสำรองรันทุกคืนตรงเวลาและล้มเหลวทุกคืน แต่ข้อความส่งคนไปเช็กว่า
     * "เปิดเครื่องไว้ไหม" ซึ่งไม่ใช่ปัญหาเลย เสียเวลาไปสองสัปดาห์
     */
    const attempt = attempts.get(attemptKey(job.name));
    const ranRecently =
      attempt != null && (now - attempt.lastSeenAt.getTime()) / 36e5 <= job.staleHours;

    await sendAdminAlert(
      [
        `🟠 ${job.label} ไม่ได้รายงานผลมา ${Math.round(hours)} ชั่วโมง`,
        `ล่าสุดที่สำเร็จ: ${last.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
        "",
        ...(ranRecently
          ? [
              `งานยังถูกเรียกอยู่ (ล่าสุด ${attempt!.lastSeenAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })})`,
              "= รันแล้วล้มเหลวทุกครั้ง ไม่ใช่ไม่ได้รัน",
              ...(attempt!.detail ? [`ข้อความล่าสุด: ${clampDetail(attempt!.detail)}`] : []),
            ]
          : ["ไม่มีร่องรอยว่าถูกเรียกเลย = น่าจะไม่ได้รัน ไม่ใช่รันแล้วพัง"]),
        "",
        "ต้องทำ:",
        ...job.howToFix.map((s, i) => `${i + 1}) ${s}`),
      ].join("\n"),
    ).catch((e) => console.error("stale job alert failed:", e));
  }

  await warnIfEmailBroken();
  return stale;
}

/**
 * อีเมลส่งไม่ออกต้องมีคนทัก ทุกวัน จนกว่าจะแก้
 *
 * เป็นความล้มเหลวที่มองไม่เห็นจากข้างนอกเลย — เว็บยังเปิดปกติ กดอนุมัติได้ปกติ
 * ลูกค้าแค่ไม่ได้รับอะไร แล้วไปถามแอดมินทีละคน โดยไม่มีใครรู้ว่าต้นเหตุคืออะไร
 * แจ้งเตือนซ้ำทุกวันโดยตั้งใจ เพราะยิ่งปล่อยไว้นาน ยิ่งมีลูกค้าที่ไม่ได้รับของ
 */
async function warnIfEmailBroken(): Promise<void> {
  if (emailEnabled) return;

  const { hasKey, hasFrom } = emailConfigStatus();
  const missing = [!hasKey && "RESEND_API_KEY", !hasFrom && "EMAIL_FROM"].filter(Boolean).join(" และ ");
  await sendAdminAlert(
    [
      "🔴 ระบบอีเมลส่งไม่ออกเลย",
      `ขาดค่า: ${missing}`,
      "",
      "ผลกระทบตอนนี้:",
      "· ลูกค้าที่จ่ายเงินไม่ได้รับใบเสร็จ",
      "· ไม่ได้ลิงก์เข้ากลุ่ม Telegram ทางอีเมล",
      "· ไม่ได้อีเมลเตือนก่อนหมดอายุ",
      "· สมาชิกรีเซ็ตรหัสผ่านเองไม่ได้",
      "",
      `ต้องทำ: ตั้ง ${missing} บน Vercel แล้ว deploy ใหม่หนึ่งครั้ง`,
      "ดูสถานะได้ที่ /admin/system",
    ].join("\n"),
  ).catch((e) => console.error("email broken alert failed:", e));
}
