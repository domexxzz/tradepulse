import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ต่ออายุแล้วต้องได้ของจริง — ทั้งอินดิเคเตอร์และกลุ่ม Telegram
 *
 * เคสที่พังจริง 30 ต.ค. 69: ลูกค้า 6 รายต่ออายุก่อนหมดอายุ แล้วไม่ได้อินดิเคเตอร์
 * อีก 2 รายไม่ได้เข้ากลุ่ม ทั้งสองอย่างเกิดจากทางลัดเดียวกันคือ "เห็นสถานะเดิม
 * แล้วถือว่าเรียบร้อยแล้ว" ซึ่งเงียบสนิท ไม่มี error ไม่มีคิวค้างให้แอดมินเห็น
 *
 * เทสต์นี้ล็อกไว้ว่าสถานะเดิมต้องไม่ใช่เหตุผลให้ข้ามการส่งมอบ
 */

const userFindUnique = vi.fn();
const grantFindFirst = vi.fn();
const grantUpdate = vi.fn();
const grantUpdateMany = vi.fn();
const tgFindFirst = vi.fn();
const tgUpdate = vi.fn();
const tgUpdateMany = vi.fn();

const grantTradingViewAccess = vi.fn();
const createMemberInviteLink = vi.fn();
const isGroupMember = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    accessGrant: {
      findFirst: (...a: unknown[]) => grantFindFirst(...a),
      update: (...a: unknown[]) => grantUpdate(...a),
      updateMany: (...a: unknown[]) => grantUpdateMany(...a),
    },
    telegramGrant: {
      findFirst: (...a: unknown[]) => tgFindFirst(...a),
      update: (...a: unknown[]) => tgUpdate(...a),
      updateMany: (...a: unknown[]) => tgUpdateMany(...a),
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
  isSubscriptionActive: vi.fn(() => true),
  ACTIVE_STATUSES: ["ACTIVE"],
}));
vi.mock("@/lib/fulfillment", () => ({
  recordPayment: vi.fn(),
  ensureAccessGrant: vi.fn(),
  ensureTelegramGrant: vi.fn(),
  ensureDiscordRole: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({
  INVITE_DAYS: 7,
  telegramGroupManaged: true,
  currentChatId: "-100999",
  sendAdminAlert: vi.fn(),
  removeGroupMember: vi.fn(),
  revokeInviteLink: vi.fn(),
  createMemberInviteLink: (...a: unknown[]) => createMemberInviteLink(...a),
  isGroupMember: (...a: unknown[]) => isGroupMember(...a),
}));

const { syncTradingViewGrant, ensureTelegramInvite } = await import("@/lib/lifecycle");

const DAY = 24 * 60 * 60 * 1000;
/** ค่าที่ถูกเขียนลงคิว Telegram ในการ update ครั้งล่าสุด */
const lastTgData = () =>
  (tgUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> } | undefined)?.data ?? {};

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ tradingViewUsername: "renewer", telegramUserId: null });
  grantUpdate.mockResolvedValue({});
  grantUpdateMany.mockResolvedValue({ count: 0 });
  tgUpdate.mockResolvedValue({});
  tgUpdateMany.mockResolvedValue({ count: 0 });
  grantTradingViewAccess.mockResolvedValue({ ok: true, queued: true });
  createMemberInviteLink.mockResolvedValue("https://t.me/+newlink");
  isGroupMember.mockResolvedValue(false);
});

/**
 * ตารางคิวปลอมที่ "เคารพเงื่อนไข where" — จำเป็นสำหรับเทสต์ชุดนี้
 *
 * ถ้า mock ตอบแถวเดิมทุกครั้งไม่ว่า where จะเป็นอะไร เทสต์จะผ่านทั้งก่อนและหลังแก้
 * เพราะบั๊กตัวจริงอยู่ที่ "รายการสถานะที่ค้นหา" ไม่ใช่ที่โค้ดหลังจากเจอแถว
 */
const grantTableOf = (rows: { id: string; status: string }[]) =>
  async (args: { where: { status: { in: string[] } } }) =>
    rows.find((r) => args.where.status.in.includes(r.status)) ?? null;

describe("ต่ออายุ TradingView", () => {
  it("คิวเป็น GRANTED จากรอบก่อน ก็ยังต้องสั่งบอทต่ออายุให้", async () => {
    // บั๊กตัวนี้ทำให้ลูกค้าที่ต่ออายุ "ก่อน" หมดอายุไม่ได้ต่อสิทธิ์เลย เงียบสนิท
    // เพราะสถานะของคนที่เคยได้อินดิเคเตอร์แล้วคือ GRANTED ซึ่งเดิมไม่อยู่ในรายการค้นหา
    grantFindFirst.mockImplementation(grantTableOf([{ id: "g1", status: "GRANTED" }]));

    await syncTradingViewGrant("u1");

    expect(grantTradingViewAccess).toHaveBeenCalledWith("renewer", expect.any(Number));
  });

  it("คิวรออนุมัติปกติก็ยังต้องสั่งบอทเหมือนเดิม", async () => {
    grantFindFirst.mockImplementation(grantTableOf([{ id: "g1", status: "PENDING" }]));

    await syncTradingViewGrant("u1");

    expect(grantTradingViewAccess).toHaveBeenCalledWith("renewer", expect.any(Number));
  });

  it("ไม่มีคิวเลยก็ยังต้องไม่ทำอะไร — ห้ามเพิ่มสิทธิ์ให้คนที่ไม่มีคิว", async () => {
    grantFindFirst.mockImplementation(grantTableOf([]));

    await syncTradingViewGrant("u1");

    expect(grantTradingViewAccess).not.toHaveBeenCalled();
  });
});

describe("ต่ออายุกลุ่ม Telegram", () => {
  it('สถานะ ADDED แต่ไม่ได้อยู่ในกลุ่มจริง ต้องออกลิงก์ใหม่ให้', async () => {
    userFindUnique.mockResolvedValue({ tradingViewUsername: null, telegramUserId: "55" });
    isGroupMember.mockResolvedValue(false);
    tgFindFirst.mockResolvedValue({
      id: "t1",
      status: "ADDED",
      inviteLink: "https://t.me/+old",
      invitedAt: new Date(Date.now() - 40 * DAY),
      chatId: "-100999",
      telegramUserId: "55",
    });

    await ensureTelegramInvite("u1");

    expect(createMemberInviteLink).toHaveBeenCalled();
    // ต้องล้างร่องรอยการส่งอีเมลด้วย ไม่งั้นรอบกวาดรายวันจะไม่ส่งใบใหม่ให้ลูกค้า
    expect(lastTgData().notifiedAt).toBeNull();
  });

  it("ยังอยู่ในกลุ่มจริง ไม่ต้องออกลิงก์ใหม่", async () => {
    userFindUnique.mockResolvedValue({ tradingViewUsername: null, telegramUserId: "55" });
    isGroupMember.mockResolvedValue(true);
    tgFindFirst.mockResolvedValue({
      id: "t1",
      status: "ADDED",
      inviteLink: null,
      invitedAt: null,
      chatId: "-100999",
      telegramUserId: "55",
    });

    await ensureTelegramInvite("u1");

    expect(createMemberInviteLink).not.toHaveBeenCalled();
  });

  it("ลิงก์ใบเก่าหมดอายุแล้ว (เกิน INVITE_DAYS) ต้องออกใบใหม่", async () => {
    tgFindFirst.mockResolvedValue({
      id: "t1",
      status: "PENDING",
      inviteLink: "https://t.me/+expired",
      invitedAt: new Date(Date.now() - 30 * DAY),
      chatId: "-100999",
      telegramUserId: null,
    });

    await ensureTelegramInvite("u1");

    expect(createMemberInviteLink).toHaveBeenCalled();
  });

  it("ลิงก์ที่ยังไม่หมดอายุ ห้ามออกใบใหม่ทับ — ใบที่ส่งอีเมลไปแล้วจะใช้ไม่ได้", async () => {
    tgFindFirst.mockResolvedValue({
      id: "t1",
      status: "PENDING",
      inviteLink: "https://t.me/+fresh",
      invitedAt: new Date(Date.now() - 1 * DAY),
      chatId: "-100999",
      telegramUserId: null,
    });

    await ensureTelegramInvite("u1");

    expect(createMemberInviteLink).not.toHaveBeenCalled();
  });
});
