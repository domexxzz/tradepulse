import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * คิวถอนสิทธิ์ต้องไม่วนสั่งซ้ำชุดเดิมทุกรอบ cron
 *
 * ของเดิมหยิบ PENDING_REVOKE 15 แถวที่เก่าสุดทุก 10 นาทีโดยไม่ดู lastDispatchedAt
 * และบอทเกือบทุกครั้งตอบ queued = true (รับเข้าคิว ยังไม่ทำ) แถวจึงคาสถานะเดิม
 * แล้วถูกหยิบซ้ำรอบหน้า — ชุดเดิมวนไม่จบ ยัดงานขยะเข้าคิวบอทชั่วโมงละ ~90 งาน
 *
 * วัดได้จริง 30 ต.ค. 69: คิวบอท 370+ งาน · บวมจาก 366 เป็น 394 ใน 45 วินาที
 * ลูกค้าที่เพิ่งจ่ายเงินต้องต่อคิวหลังงานขยะ 6+ ชั่วโมง
 */

const findMany = vi.fn();
const update = vi.fn();
const count = vi.fn();
const revokeTradingViewAccess = vi.fn();
const bridgeQueueDepth = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessGrant: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
      count: (...a: unknown[]) => count(...a),
    },
    telegramGrant: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  bridgeQueueDepth: (...a: unknown[]) => bridgeQueueDepth(...a),
  revokeTradingViewAccess: (...a: unknown[]) => revokeTradingViewAccess(...a),
}));
vi.mock("@/lib/telegram", () => ({ telegramGroupManaged: false }));
vi.mock("@/lib/lifecycle", () => ({
  syncTradingViewGrant: vi.fn(),
  ensureTelegramInvite: vi.fn(),
}));
vi.mock("@/lib/subscription", () => ({ ACTIVE_STATUSES: ["ACTIVE"] }));

const { runReconcile, MAX_FAILS } = await import("@/lib/reconcile");

const MIN = 60_000;
const user = { tradingViewUsername: "someone" };

interface FakeRevokeRow {
  id: string;
  failCount: number;
  lastDispatchedAt: Date | null;
  /** ลูกค้ายังมีแพ็กเกจที่ใช้งานอยู่ไหม */
  active?: boolean;
}

/** แถวคิวถอนปลอมที่ "เคารพเงื่อนไข where" — ไม่งั้นเทสต์ผ่านทั้งก่อนและหลังแก้ */
function revokeTable(rows: FakeRevokeRow[]) {
  findMany.mockImplementation(async (args: Record<string, never>) => {
    const w = (args as { where?: Record<string, unknown> }).where ?? {};
    if (w.status !== "PENDING_REVOKE") return [];
    // โค้ดก่อนแก้ไม่มีด่าน "ห้ามถอนคนที่ยังจ่ายเงินอยู่" เลย
    const guardsActive = Boolean(
      (w.user as { subscriptions?: { none?: unknown } } | undefined)?.subscriptions?.none
    );
    return rows
      .filter((r) => {
        if (guardsActive && r.active) return false;
        const cap = w.failCount as { lt?: number } | undefined;
        if (cap?.lt !== undefined && r.failCount >= cap.lt) return false;
        const or = w.OR as { lastDispatchedAt: unknown }[] | undefined;
        if (!or) return true; // โค้ดก่อนแก้ไม่มีเงื่อนไขนี้เลย
        const lt = (or[1]?.lastDispatchedAt as { lt?: Date } | undefined)?.lt;
        return r.lastDispatchedAt === null || (lt !== undefined && r.lastDispatchedAt < lt);
      })
      .map((r) => ({ id: r.id, user }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  count.mockResolvedValue(0);
  // คิวบอทยาว = ต้องใช้เวลารอแบบเต็ม (REDISPATCH_MINUTES) ไม่ใช่แบบคิวว่าง
  bridgeQueueDepth.mockResolvedValue(370);
  revokeTradingViewAccess.mockResolvedValue({ ok: true, queued: true });
});

describe("คิวถอนสิทธิ์ที่ค้าง", () => {
  it("เพิ่งสั่งไปเมื่อกี้ ห้ามสั่งซ้ำ — นี่คือวงวนที่ทำให้คิวบอทบวม 370 งาน", async () => {
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: new Date(Date.now() - 2 * MIN) }]);

    await runReconcile();

    expect(revokeTradingViewAccess).not.toHaveBeenCalled();
  });

  it("ปล่อยไว้นานพอแล้ว ถึงสั่งซ้ำได้", async () => {
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: new Date(Date.now() - 90 * MIN) }]);

    await runReconcile();

    expect(revokeTradingViewAccess).toHaveBeenCalledWith("someone");
  });

  it("ยังไม่เคยสั่งเลย ต้องสั่ง", async () => {
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: null }]);

    await runReconcile();

    expect(revokeTradingViewAccess).toHaveBeenCalledTimes(1);
  });

  it("ล้มเหลวครบเพดานแล้ว ต้องเลิกลอง ไม่ใช่วนกินคิวบอทต่อ", async () => {
    revokeTable([{ id: "r1", failCount: MAX_FAILS, lastDispatchedAt: null }]);

    await runReconcile();

    expect(revokeTradingViewAccess).not.toHaveBeenCalled();
  });

  it("จดเวลาที่สั่งก่อนยิงเสมอ ไม่ใช่เฉพาะตอนสำเร็จ", async () => {
    // ไม่จดก่อน = รอบหน้าเห็นเป็น \"ไม่เคยสั่ง\" แล้ววนซ้ำทันที ซึ่งคือบั๊กตัวเดิม
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: null }]);

    await runReconcile();

    const first = update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(first.data.lastDispatchedAt).toBeInstanceOf(Date);
  });

  it("บอทปฏิเสธงาน = นับความล้มเหลว จะได้ถึงเพดานแล้วหยุดเอง", async () => {
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: null }]);
    revokeTradingViewAccess.mockResolvedValue({ ok: false, reason: "ไม่พบ username" });

    await runReconcile();

    const last = update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data.failCount).toEqual({ increment: 1 });
  });

  it("แพ็กเกจยังใช้งานอยู่ ห้ามถอนเด็ดขาด แม้คิวจะสั่งไว้", async () => {
    /**
     * คิวถอนเกิดตอนหมดอายุ แต่ลูกค้าต่ออายุทีหลังได้ ถ้าบอทถอนไม่สำเร็จแถวจะค้าง
     * ข้ามรอบบิล พอเราเพิ่งให้สิทธิ์เขาใหม่ รอบถัดไปจะถอนออกให้เอง
     * = จ่ายเงินแล้วสิทธิ์หลุดใน 10 นาที (เจอจริงกับ @anupong6914 30 ต.ค. 69)
     */
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: null, active: true }]);

    await runReconcile();

    expect(revokeTradingViewAccess).not.toHaveBeenCalled();
  });

  it("ติดต่อบอทไม่ได้ = ปัญหาของท่อ ห้ามกินโควตาเลิกลอง", async () => {
    revokeTable([{ id: "r1", failCount: 0, lastDispatchedAt: null }]);
    revokeTradingViewAccess.mockResolvedValue({ ok: false, unreachable: true, reason: "ติดต่อบอทไม่ได้" });

    await runReconcile();

    const last = update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data).not.toHaveProperty("failCount");
  });
});
