import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "เรียกแล้วไม่ throw" ไม่ใช่ "สำเร็จ"
 *
 * ensureTelegramInvite กลืน error ไว้ข้างในทั้งหมดโดยตั้งใจ (ล้มที่ Telegram
 * ไม่ควรลากการเปิดสิทธิ์ร่วงไปด้วย) ตัวที่เรียกจึงแยกไม่ออกว่าสำเร็จหรือไม่
 * ของเดิมนับว่าสำเร็จทุกครั้ง — ตัวเลขที่รายงานเป็นเท็จโดยสมบูรณ์
 *
 * และตัวเลือกแถวกับตัวซ่อมมองคนละใบ: ที่นี่เลือก "ใบที่ไม่มีลิงก์" แต่ตัวซ่อม
 * ทำงานกับ "ใบล่าสุด" ของผู้ใช้เสมอ ใบเก่าจึงถูกหยิบซ้ำทุก 5 นาทีตลอดไป
 * (เห็นจริงบน production 2 พ.ย. 69 — invitesCreated = 1 ทุกรอบติดกันเป็นชั่วโมง
 *  ทั้งที่สมาชิกทั้ง 190 คนมีลิงก์หรืออยู่ในกลุ่มครบแล้ว)
 */

const tgFindMany = vi.fn();
const tgFindUnique = vi.fn();
const tgFindFirst = vi.fn();
const tgUpdate = vi.fn();
const ensureTelegramInvite = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessGrant: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    telegramGrant: {
      findMany: (...a: unknown[]) => tgFindMany(...a),
      findUnique: (...a: unknown[]) => tgFindUnique(...a),
      findFirst: (...a: unknown[]) => tgFindFirst(...a),
      update: (...a: unknown[]) => tgUpdate(...a),
    },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  bridgeQueueDepth: vi.fn(async () => 0),
  revokeTradingViewAccess: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({ telegramGroupManaged: true }));
vi.mock("@/lib/lifecycle", () => ({
  syncTradingViewGrant: vi.fn(),
  ensureTelegramInvite: (...a: unknown[]) => ensureTelegramInvite(...a),
  healActiveMembersQueuedForRemoval: vi.fn(async () => ({ grants: 0, telegram: 0, members: [] })),
}));
vi.mock("@/lib/subscription", () => ({ ACTIVE_STATUSES: ["ACTIVE"] }));
vi.mock("@/lib/alert-throttle", () => ({
  sendAdminAlertThrottled: vi.fn(async () => ({ sent: true, suppressed: 0 })),
}));

const { runReconcile } = await import("@/lib/reconcile");

beforeEach(() => {
  vi.clearAllMocks();
  tgFindMany.mockResolvedValue([{ id: "t_old", userId: "u1" }]);
  tgFindFirst.mockResolvedValue(null);
  tgUpdate.mockResolvedValue({});
  ensureTelegramInvite.mockResolvedValue(undefined);
});

describe("เติมลิงก์เชิญย้อนหลัง", () => {
  it("ได้ลิงก์จริง = นับว่าสร้างสำเร็จ", async () => {
    tgFindUnique.mockResolvedValue({ inviteLink: "https://t.me/+abc" });

    const res = await runReconcile();

    expect(res.invitesCreated).toBe(1);
    expect(res.invitesStale).toBe(0);
  });

  it("เรียกแล้วไม่ได้ลิงก์ = ห้ามนับว่าสำเร็จ", async () => {
    tgFindUnique.mockResolvedValue({ inviteLink: null });

    const res = await runReconcile();

    expect(ensureTelegramInvite).toHaveBeenCalledWith("u1");
    expect(res.invitesCreated).toBe(0);
  });

  it("ไม่ได้ลิงก์แต่มีใบอื่นคุมอยู่แล้ว = ปิดใบเก่า จะได้ไม่วนหยิบซ้ำทุก 5 นาที", async () => {
    tgFindUnique.mockResolvedValue({ inviteLink: null });
    tgFindFirst.mockResolvedValue({ id: "t_new" });

    const res = await runReconcile();

    expect(res.invitesCreated).toBe(0);
    expect(res.invitesStale).toBe(1);
    expect(tgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t_old" },
        data: expect.objectContaining({ status: "SUPERSEDED" }),
      })
    );
  });

  it("ไม่ได้ลิงก์และไม่มีใบอื่นเลย = อย่าปิดทิ้ง คนนี้ยังไม่มีทางเข้ากลุ่มจริง ๆ", async () => {
    tgFindUnique.mockResolvedValue({ inviteLink: null });
    tgFindFirst.mockResolvedValue(null);

    const res = await runReconcile();

    expect(res.invitesStale).toBe(0);
    expect(tgUpdate).not.toHaveBeenCalled();
  });
});
