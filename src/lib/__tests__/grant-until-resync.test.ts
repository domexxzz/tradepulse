import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "GRANTED" บอกแค่ว่าเคยให้สำเร็จ ไม่ได้บอกว่าให้ถึงวันไหน
 *
 * reconcile เดิมมองแค่แถว PENDING แถว GRANTED ถือว่าจบ
 * ลูกค้าต่ออายุตอนบอทติดต่อไม่ได้ → คำสั่งต่อวันไปไม่ถึง TradingView → แถวยัง GRANTED
 * → ไม่มีใครสั่งซ้ำ → สิทธิ์จริงดับตามวันเดิม ขณะที่หน้าแอดมินขึ้นว่า "เพิ่มแล้ว"
 * ลูกค้าจ่ายเงินแล้วใช้ไม่ได้ และระบบไม่มีทางรู้ตัวเองเลย
 *
 * เจอจริง 3 พ.ย. 69 — phongth_wang · p_f123 · Puchan07 ตอนคอมเฟิร์สออฟไลน์ 7 ชม.
 * ต้องให้ลูกค้าทักมาเองถึงรู้
 */

const grantFindMany = vi.fn();
const grantUpdate = vi.fn();
const syncTradingViewGrant = vi.fn();
const bridgeQueueDepth = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessGrant: {
      findMany: (...a: unknown[]) => grantFindMany(...a),
      update: (...a: unknown[]) => grantUpdate(...a),
      count: vi.fn(async () => 0),
    },
    telegramGrant: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  bridgeQueueDepth: (...a: unknown[]) => bridgeQueueDepth(...a),
  revokeTradingViewAccess: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({ telegramGroupManaged: false }));
vi.mock("@/lib/lifecycle", () => ({
  syncTradingViewGrant: (...a: unknown[]) => syncTradingViewGrant(...a),
  ensureTelegramInvite: vi.fn(),
  healActiveMembersQueuedForRemoval: vi.fn(async () => ({ grants: 0, telegram: 0, members: [] })),
}));
vi.mock("@/lib/subscription", () => ({ ACTIVE_STATUSES: ["ACTIVE"] }));
vi.mock("@/lib/alert-throttle", () => ({
  sendAdminAlertThrottled: vi.fn(async () => ({ sent: true, suppressed: 0 })),
}));

const { runReconcile } = await import("@/lib/reconcile");

const DAY = 24 * 60 * 60 * 1000;

/** ตอบเฉพาะตอนถูกถามหาแถว GRANTED — คิวอื่นตอบว่าง */
function grantedRows(rows: { id: string; until: Date | null; paidUntil: Date }[]) {
  grantFindMany.mockImplementation(async (args: Record<string, never>) => {
    const w = (args as { where?: { status?: unknown } }).where ?? {};
    if (w.status !== "GRANTED") return [];
    return rows.map((r) => ({
      id: r.id,
      userId: "u_" + r.id,
      grantedUntil: r.until,
      user: { subscriptions: [{ currentPeriodEnd: r.paidUntil }] },
    }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  bridgeQueueDepth.mockResolvedValue(0); // บอทว่าง
  grantUpdate.mockResolvedValue({});
  grantedRows([]);
});

describe("ไล่ให้ TradingView ตรงกับที่ลูกค้าจ่าย", () => {
  it("จ่ายถึง 2 ธ.ค. แต่ให้สิทธิ์ไว้ถึงเมื่อวาน = ต้องสั่งซ้ำ", async () => {
    grantedRows([
      { id: "g1", until: new Date(Date.now() - 1 * DAY), paidUntil: new Date(Date.now() + 29 * DAY) },
    ]);

    const res = await runReconcile();

    expect(res.resynced).toBe(1);
    expect(syncTradingViewGrant).toHaveBeenCalledWith("u_g1");
  });

  it("ไม่รู้ว่าให้ถึงวันไหน (แถวเก่า) = สั่งซ้ำหนึ่งรอบให้สองฝั่งตรงกัน", async () => {
    grantedRows([{ id: "g2", until: null, paidUntil: new Date(Date.now() + 29 * DAY) }]);

    const res = await runReconcile();

    expect(res.resynced).toBe(1);
  });

  it("ให้สิทธิ์ไว้ตรงกับที่จ่ายแล้ว = ห้ามแตะ อย่าเปลืองคิวบอท", async () => {
    const paid = new Date(Date.now() + 29 * DAY);
    grantedRows([{ id: "g3", until: paid, paidUntil: paid }]);

    const res = await runReconcile();

    expect(res.resynced).toBe(0);
    expect(syncTradingViewGrant).not.toHaveBeenCalled();
  });

  it("บอทไม่ว่าง = ไม่แย่งคิวคนที่เพิ่งจ่ายเงินแล้วรออยู่", async () => {
    bridgeQueueDepth.mockResolvedValue(12);
    grantedRows([{ id: "g4", until: null, paidUntil: new Date(Date.now() + 29 * DAY) }]);

    const res = await runReconcile();

    expect(res.resynced).toBe(0);
    expect(syncTradingViewGrant).not.toHaveBeenCalled();
  });

  it("จดเวลาที่สั่งก่อนยิงเสมอ — ไม่งั้นรอบหน้าสั่งซ้ำทันที", async () => {
    grantedRows([{ id: "g5", until: null, paidUntil: new Date(Date.now() + 29 * DAY) }]);

    await runReconcile();

    const call = grantUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(call.data.lastDispatchedAt).toBeInstanceOf(Date);
  });
});
