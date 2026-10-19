import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * /api/health — ให้ตัวเฝ้าระบบภายนอก (GitHub Actions: watchdog) รู้ว่าเว็บ "และฐานข้อมูล" ยังใช้ได้
 *
 * เหตุที่ต้องมี: 15-19 ต.ค. 69 ฐานข้อมูลล็อก หน้าแรกยังตอบ 200 ปกติ (หน้า static)
 * แต่ทุกหน้าที่ใช้ข้อมูลพังหมด — เช็คแค่หน้าแรกจึงไม่เห็นปัญหา ต้องถามฐานข้อมูลจริง
 */

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  // ต้องมีปีกกา: ถ้า return ตัว mock ออกไป vitest จะเรียกมันเป็น cleanup หลังจบแต่ละเทสต์
  beforeEach(() => {
    queryRaw.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("ตอบ 200 ok เมื่อฐานข้อมูลตอบ", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: true });
  });

  it("ตอบ 503 เมื่อต่อฐานข้อมูลไม่ได้ และไม่เผยรายละเอียด error สู่สาธารณะ", async () => {
    queryRaw.mockImplementation(() => Promise.reject(new Error("Can't reach database server at `ep-secret-host.neon.tech`")));
    const res = await GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, db: false });
    expect(text).not.toContain("neon");
  });

  it("ตอบ 503 เมื่อฐานข้อมูลค้างไม่ตอบ แทนที่จะแขวนจน function หมดเวลา", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => {}));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;
    expect(res.status).toBe(503);
  });

  it("ห้าม cache ผลตรวจ", async () => {
    queryRaw.mockResolvedValue([]);
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
