import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";

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
    /** บอกวิธีแก้ไปเลย ไม่ใช่แค่บอกว่ามีปัญหา */
    howToFix: [
      "เช็คคอมเฟิร์ส — เปิดเครื่องและ login ไว้ไหม (งานตั้งเวลา QVXDatabaseBackup รัน 03:00)",
      "ดูผลรอบล่าสุดที่ C:\\QVXBackup\\STATUS.txt",
      "ทดสอบท่อแจ้งเตือน: powershell -File C:\\QVXBackup\\test-alert.ps1",
    ],
  },
] as const;

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
export async function checkStaleJobs(): Promise<StaleJob[]> {
  const rows = await prisma.systemHeartbeat.findMany({
    where: { name: { in: WATCHED_JOBS.map((j) => j.name) } },
  });
  const seen = new Map(rows.map((r) => [r.name, r.lastSeenAt]));
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
    await sendAdminAlert(
      [
        `🟠 ${job.label} ไม่ได้รายงานผลมา ${Math.round(hours)} ชั่วโมง`,
        `ล่าสุดที่สำเร็จ: ${last.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
        "",
        "ไม่มีข้อความว่าล้มเหลว = ไม่ได้รันเลย ไม่ใช่ว่ารันแล้วผ่าน",
        "",
        "ต้องทำ:",
        ...job.howToFix.map((s, i) => `${i + 1}) ${s}`),
      ].join("\n"),
    ).catch((e) => console.error("stale job alert failed:", e));
  }

  return stale;
}
