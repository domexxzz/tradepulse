import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ต้องมีใครสักคนถามว่า "ทำไมทุกใบถึงพังพร้อมกัน"
 *
 * 2 พ.ย. 69: TradingView เปลี่ยน data-qa-id ของช่องค้นหา บอทถอนสิทธิ์ล้มเหลว
 * 330 งานรวดในวันเดียว และไม่มีการแจ้งเตือนใดดังพอ — แต่ละใบล้มเหลวแยกกัน
 * ตัวกันสแปมกลบข้อความซ้ำทิ้ง (ซึ่งถูกของมัน) แต่ไม่มีใครรวมตัวเลข
 * กว่าจะรู้ก็ตอนแอดมินทักมาว่าลูกค้าเข้าไม่ได้ — 13 วันหลังของจริงเริ่มพัง
 *
 * เทสต์นี้ล็อกทั้งสองทาง: พังเป็นวงต้องดัง และพังรายคนต้องเงียบ
 */

const grantFindMany = vi.fn();
const sendAdminAlertThrottled = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessGrant: {
      findMany: (...a: unknown[]) => grantFindMany(...a),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    telegramGrant: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  bridgeQueueDepth: vi.fn(async () => 0),
  revokeTradingViewAccess: vi.fn(async () => ({ ok: true, queued: true })),
}));
vi.mock("@/lib/telegram", () => ({ telegramGroupManaged: false }));
vi.mock("@/lib/lifecycle", () => ({
  syncTradingViewGrant: vi.fn(),
  ensureTelegramInvite: vi.fn(),
  healActiveMembersQueuedForRemoval: vi.fn(async () => ({ grants: 0, telegram: 0, members: [] })),
}));
vi.mock("@/lib/subscription", () => ({ ACTIVE_STATUSES: ["ACTIVE"] }));
vi.mock("@/lib/alert-throttle", () => ({
  sendAdminAlertThrottled: (...a: unknown[]) => sendAdminAlertThrottled(...a),
}));

const { runReconcile, MAX_FAILS } = await import("@/lib/reconcile");

const DOM_BROKEN = "ถอนสิทธิ์ไม่สำเร็จ (ดู log ของบอท)";

/** แถวที่ติดเพดานแล้ว — มีเฉพาะตอน reportSystemicFailures ถาม */
function stuckRows(rows: { tv: string; reason: string; status?: string }[]) {
  grantFindMany.mockImplementation(async (args: Record<string, never>) => {
    const w = (args as { where?: { failCount?: { gte?: number } } }).where ?? {};
    // ถามหา "ของที่ติดเพดาน" เท่านั้นถึงตอบ ส่วนคิวสั่งซ้ำตอบว่าง
    if (w.failCount?.gte === undefined) return [];
    return rows.map((r, i) => ({
      status: r.status ?? "PENDING_REVOKE",
      lastFailReason: r.reason,
      failCount: MAX_FAILS + i,
      user: { email: `${r.tv}@x.c`, tradingViewUsername: r.tv },
    }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendAdminAlertThrottled.mockResolvedValue({ sent: true, suppressed: 0 });
  stuckRows([]);
});

describe("จับความล้มเหลวที่เป็นของส่วนกลาง", () => {
  it("หลายคนพังด้วยข้อความเดียวกัน = ต้องเตือน พร้อมบอกเหตุผลและตัวอย่าง", async () => {
    stuckRows(
      ["u6612347", "Ja2533", "p_f123", "sainum", "Wcnp8899", "zbbbenz"].map((tv) => ({
        tv,
        reason: DOM_BROKEN,
      }))
    );

    const res = await runReconcile();

    expect(res.systemicAlerts).toBe(1);
    const [key, text] = sendAdminAlertThrottled.mock.calls[0];
    // กันซ้ำต่อ "เหตุผล" ไม่ใช่ต่อใบ — เหตุผลใหม่ต้องดังทันที
    expect(key).toBe(`systemic-fail:${DOM_BROKEN}`);
    expect(text).toContain("6 ราย");
    expect(text).toContain(DOM_BROKEN);
    expect(text).toContain("u6612347");
  });

  it("พังคนละเหตุผล = ไม่ใช่ของส่วนกลาง ต้องเงียบ", async () => {
    stuckRows([
      { tv: "a1", reason: "ไม่พบ username a1 ในระบบ TradingView" },
      { tv: "a2", reason: "ไม่พบ username a2 ในระบบ TradingView" },
      { tv: "a3", reason: "ไม่พบ username a3 ในระบบ TradingView" },
      { tv: "a4", reason: "ไม่พบ username a4 ในระบบ TradingView" },
      { tv: "a5", reason: "ไม่พบ username a5 ในระบบ TradingView" },
      { tv: "a6", reason: "ไม่พบ username a6 ในระบบ TradingView" },
    ]);

    const res = await runReconcile();

    expect(res.systemicAlerts).toBe(0);
    expect(sendAdminAlertThrottled).not.toHaveBeenCalled();
  });

  it("พังไม่กี่คน ยังไม่ถึงเกณฑ์ = เงียบไว้ก่อน อย่าปลุกคนกลางดึกเพราะสองใบ", async () => {
    stuckRows([
      { tv: "b1", reason: DOM_BROKEN },
      { tv: "b2", reason: DOM_BROKEN },
    ]);

    const res = await runReconcile();

    expect(res.systemicAlerts).toBe(0);
    expect(sendAdminAlertThrottled).not.toHaveBeenCalled();
  });

  it("ไม่มีใครติดเพดาน = ไม่เตือน", async () => {
    const res = await runReconcile();

    expect(res.systemicAlerts).toBe(0);
    expect(sendAdminAlertThrottled).not.toHaveBeenCalled();
  });
});
