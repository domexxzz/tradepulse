import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { recordHeartbeat, checkStaleJobs, WATCHED_JOBS } from "@/lib/heartbeat";

const prisma = new PrismaClient();
const JOB = "db-backup";
const job = WATCHED_JOBS.find((j) => j.name === JOB)!;

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5);

beforeEach(async () => {
  await prisma.systemHeartbeat.deleteMany({ where: { name: JOB } });
});

afterAll(async () => {
  await prisma.systemHeartbeat.deleteMany({ where: { name: JOB } });
  await prisma.$disconnect();
});

/**
 * ตัวนี้เป็นด่านสุดท้ายที่จับ "งานสำรองข้อมูลหยุดไปเงียบ ๆ"
 * ถ้าเกณฑ์เวลาเพี้ยน จะได้อย่างใดอย่างหนึ่ง: เตือนทุกวันจนคนเลิกอ่าน
 * หรือไม่เตือนเลยตอนที่ควรเตือน ซึ่งคือปัญหาเดิมที่เพิ่งแก้ไป
 */
describe("B-1 · จับงานที่หยุดไปเงียบ ๆ", () => {
  it(`งานสำรองต้องตั้งเกณฑ์ให้จับการพลาดครั้งเดียวได้ (รัน 03:00 · cron 08:00 → พลาด 1 วัน = 29 ชม.)`, () => {
    expect(job.staleHours).toBeGreaterThan(5);
    expect(job.staleHours).toBeLessThan(29);
  });

  it("รายงานเข้ามาเมื่อวันนี้ ต้องไม่เตือน", async () => {
    await recordHeartbeat(JOB, "1.5 MB · 23 ตาราง");
    const row = await prisma.systemHeartbeat.findUnique({ where: { name: JOB } });
    expect(row?.detail).toBe("1.5 MB · 23 ตาราง");

    expect(await checkStaleJobs()).toEqual([]);
  });

  it("เงียบเกินเกณฑ์ ต้องเตือน พร้อมบอกว่าเงียบไปกี่ชั่วโมง", async () => {
    await recordHeartbeat(JOB);
    await prisma.systemHeartbeat.update({
      where: { name: JOB },
      data: { lastSeenAt: hoursAgo(job.staleHours + 4) },
    });

    const stale = await checkStaleJobs();
    expect(stale.map((s) => s.name)).toContain(JOB);
    expect(stale[0].hoursSilent).toBeGreaterThanOrEqual(job.staleHours);
  });

  it("เงียบพอดีเกณฑ์ ยังไม่เตือน (กันเตือนพลาดเวลางานรันช้าไปหน่อย)", async () => {
    await recordHeartbeat(JOB);
    await prisma.systemHeartbeat.update({
      where: { name: JOB },
      data: { lastSeenAt: hoursAgo(job.staleHours - 0.5) },
    });

    expect(await checkStaleJobs()).toEqual([]);
  });

  it("ยังไม่เคยรายงานเข้ามาเลย ต้องไม่เตือน — ไม่งั้นเตือนทุกวันตั้งแต่ก่อนตั้งค่าเสร็จ", async () => {
    expect(await prisma.systemHeartbeat.findUnique({ where: { name: JOB } })).toBeNull();
    expect(await checkStaleJobs()).toEqual([]);
  });

  it("รายงานซ้ำต้องทับของเดิม ไม่สร้างแถวใหม่", async () => {
    await recordHeartbeat(JOB, "รอบแรก");
    await recordHeartbeat(JOB, "รอบสอง");

    const rows = await prisma.systemHeartbeat.findMany({ where: { name: JOB } });
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toBe("รอบสอง");
  });
});
