import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * การนับความล้มเหลวของคิวให้สิทธิ์ — ตัวเลขนี้คุมว่าระบบจะเลิกลองเมื่อไหร่
 *
 * พลาดได้สองทางและเจ็บคนละแบบ:
 *   นับมากไป  = ลูกค้าที่ชื่อถูกต้องถูกตัดทิ้งเพราะบอทไม่ว่างตอนนั้น จ่ายเงินแล้วไม่ได้ของ
 *   นับน้อยไป = งานที่ไม่มีวันสำเร็จวนไม่จบ กินคิวบอทและสแปมแอดมินจนเลิกอ่าน
 *
 * ทั้งสองอย่างเกิดขึ้นจริงมาแล้วในสัปดาห์เดียวกัน เทสต์นี้ล็อกเส้นแบ่งไว้
 */

const findUnique = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const grantTradingViewAccess = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => findUnique(...a) },
    accessGrant: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  grantTradingViewAccess: (...a: unknown[]) => grantTradingViewAccess(...a),
  revokeTradingViewAccess: vi.fn(),
}));
vi.mock("@/lib/subscription", () => ({
  getUserSubscription: vi.fn(async () => ({ sub: null, isActive: false })),
  ACTIVE_STATUSES: ["ACTIVE"],
}));

const { syncTradingViewGrant } = await import("@/lib/lifecycle");

/** ค่าที่ถูกเขียนลงคิวในการ update ครั้งที่ n (ครั้งแรกคือการจดเวลาที่สั่ง) */
const dataOf = (n: number) =>
  (update.mock.calls[n]?.[0] as { data: Record<string, unknown> } | undefined)?.data ?? {};
const lastData = () => dataOf(update.mock.calls.length - 1);

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ tradingViewUsername: "someone" });
  findFirst.mockResolvedValue({ id: "g1", status: "PENDING" });
  update.mockResolvedValue({});
});

describe("syncTradingViewGrant — การนับความล้มเหลว", () => {
  it("ติดต่อบอทไม่ได้ = ปัญหาของท่อ ห้ามกินโควตาเลิกลอง", async () => {
    grantTradingViewAccess.mockResolvedValue({
      ok: false,
      unreachable: true,
      reason: "ติดต่อบอทไม่ได้ทั้งตัวหลักและตัวสำรอง",
    });

    await syncTradingViewGrant("u1");

    expect(lastData()).not.toHaveProperty("failCount");
    // ยังต้องจดเหตุผลไว้ ไม่งั้นไม่มีใครรู้ว่าค้างเพราะอะไร
    expect(lastData().lastFailReason).toContain("ติดต่อบอทไม่ได้");
  });

  it("บอทปฏิเสธงาน = ความล้มเหลวจริง ต้องนับ", async () => {
    grantTradingViewAccess.mockResolvedValue({
      ok: false,
      reason: "ไม่พบ username someone ในระบบ TradingView",
    });

    await syncTradingViewGrant("u1");

    expect(lastData().failCount).toEqual({ increment: 1 });
  });

  it("บอทแค่รับงานเข้าคิว ยังไม่รู้ผล ห้ามล้างตัวนับ", async () => {
    // บั๊กตัวนี้ทำให้เพดานเลิกลองไม่มีวันถึง และตัวกันเตือนซ้ำไม่มีวันตรง
    // แอดมินได้ข้อความเดิมทุก 15 นาทีติดกันสองวัน (10 ต.ค. 69)
    grantTradingViewAccess.mockResolvedValue({ ok: true, queued: true });

    await syncTradingViewGrant("u1");

    const written = lastData();
    expect(written).not.toHaveProperty("failCount");
    expect(written).not.toHaveProperty("lastFailReason");
    // แต่ต้องจดเวลาที่สั่ง ไม่งั้นตัวไล่งานค้างจะสั่งซ้ำทุกรอบ
    expect(written.lastDispatchedAt).toBeInstanceOf(Date);
  });

  it("บอททำเสร็จทันที = สำเร็จจริง ล้างตัวนับได้", async () => {
    grantTradingViewAccess.mockResolvedValue({ ok: true, queued: false });

    await syncTradingViewGrant("u1");

    const written = lastData();
    expect(written.status).toBe("GRANTED");
    expect(written.failCount).toBe(0);
    expect(written.lastFailReason).toBeNull();
  });
});
