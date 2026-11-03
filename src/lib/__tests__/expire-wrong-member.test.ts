import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ห้ามถอนสิทธิ์คนที่ยังจ่ายเงินอยู่ — และถ้าถอนผิดไปแล้ว ต้องซ่อมคืนเอง
 *
 * ต้นเหตุจริง 2 พ.ย. 69: expireSubscription รับมาเป็น "แถวแพ็กเกจ" แต่ไปปิดสิทธิ์
 * "ระดับผู้ใช้" คนที่ปล่อยให้หลุดแล้วค่อยต่ออายุจะมีสองแถว (เก่าที่ค้างเป็น ACTIVE
 * เลยวันหมดอายุ + ใหม่ที่ยังอยู่) รอบกวาดรายวันหยิบแถวเก่ามาปิด แล้วถอนสิทธิ์
 * ทั้งชุดทิ้ง ทั้งที่ลูกค้าเพิ่งจ่ายเงินมา — เงียบสนิท ไม่มี error ให้ใครเห็น
 *
 * glaiisarins จ่ายถึง 2 ธ.ค. แต่ถูกสั่งถอน 2 ใบตอน 14:45 รอดเพราะบอทถอนพัง
 * อยู่พอดี ไม่ใช่เพราะระบบกันไว้ — เทสต์นี้ทำให้ "รอด" ไม่ใช่เรื่องของโชค
 */

const subFindFirst = vi.fn();
const subUpdate = vi.fn();
const grantFindMany = vi.fn();
const grantUpdateMany = vi.fn();
const grantFindFirst = vi.fn();
const tgFindMany = vi.fn();
const tgUpdateMany = vi.fn();
const userFindUnique = vi.fn();
const revokeTradingViewAccess = vi.fn();
const removeGroupMember = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    subscription: {
      findFirst: (...a: unknown[]) => subFindFirst(...a),
      update: (...a: unknown[]) => subUpdate(...a),
    },
    accessGrant: {
      findMany: (...a: unknown[]) => grantFindMany(...a),
      updateMany: (...a: unknown[]) => grantUpdateMany(...a),
      findFirst: (...a: unknown[]) => grantFindFirst(...a),
      update: vi.fn(async () => ({})),
    },
    telegramGrant: {
      findMany: (...a: unknown[]) => tgFindMany(...a),
      updateMany: (...a: unknown[]) => tgUpdateMany(...a),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("@/lib/tradingview", () => ({
  tvAutoGrantEnabled: true,
  grantTradingViewAccess: vi.fn(async () => ({ ok: true, queued: true })),
  revokeTradingViewAccess: (...a: unknown[]) => revokeTradingViewAccess(...a),
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
  revokeInviteLink: vi.fn(),
  createMemberInviteLink: vi.fn(async () => "https://t.me/+x"),
  isGroupMember: vi.fn(async () => false),
  removeGroupMember: (...a: unknown[]) => removeGroupMember(...a),
}));

const { expireSubscription, healActiveMembersQueuedForRemoval } = await import("@/lib/lifecycle");

const DAY = 24 * 60 * 60 * 1000;

/** แถวแพ็กเกจเก่าที่ค้างเป็น ACTIVE ทั้งที่เลยวันหมดอายุไปแล้ว */
const staleRow = {
  id: "sub_old",
  userId: "u1",
  planCode: "MONTH",
  status: "ACTIVE",
  currentPeriodEnd: new Date(Date.now() - DAY),
  stripeSubscriptionId: null,
} as never;

/** ค่าที่ถูกเขียนลง accessGrant.updateMany ครั้งล่าสุด */
const lastGrantData = () =>
  (grantUpdateMany.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> } | undefined)?.data ??
  {};

/**
 * ตาราง accessGrant ปลอมที่ตอบตาม where จริง — healer ยิง findMany สามครั้ง
 * (คิวถอน · ใบที่ยังดูแลอยู่ · ใบที่ถอนไปแล้ว) ถ้าตอบชุดเดียวทุกครั้ง
 * เทสต์จะผ่านแม้ตรรกะการกรองจะผิด
 */
interface FakeGrant {
  id: string;
  userId: string;
  status: string;
  tv?: string;
}
function grantTable(rows: FakeGrant[]) {
  grantFindMany.mockImplementation(async (args: Record<string, never>) => {
    const w = (args as { where?: { status?: unknown } }).where ?? {};
    const st = w.status as string | { in?: string[] } | undefined;
    // ไม่ระบุ status = ถามหา "ใบทั้งหมดของคนที่ยังจ่ายเงินอยู่" (ตัวซ่อมใช้หาใบล่าสุด)
    const wanted = st === undefined ? null : typeof st === "string" ? [st] : (st?.in ?? []);
    return rows
      .filter((r) => wanted === null || wanted.includes(r.status))
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        status: r.status,
        user: { email: `${r.userId}@x.c`, tradingViewUsername: r.tv ?? "someone" },
      }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  subUpdate.mockResolvedValue({});
  grantUpdateMany.mockResolvedValue({ count: 1 });
  tgUpdateMany.mockResolvedValue({ count: 1 });
  grantTable([]);
  tgFindMany.mockResolvedValue([]);
  grantFindFirst.mockResolvedValue(null);
  userFindUnique.mockResolvedValue({
    email: "a@b.c",
    name: "A",
    discordUserId: null,
    tradingViewUsername: "glaiisarins",
    telegramUserId: "555",
  });
  revokeTradingViewAccess.mockResolvedValue({ ok: true, queued: true });
  removeGroupMember.mockResolvedValue(undefined);
});

describe("ปิดแพ็กเกจที่หมดอายุ", () => {
  it("ยังมีแพ็กเกจอื่นที่จ่ายอยู่ = ปิดแค่แถวนั้น ห้ามแตะสิทธิ์", async () => {
    subFindFirst.mockResolvedValue({ id: "sub_new" }); // ต่ออายุไว้แล้ว

    await expireSubscription(staleRow);

    expect(subUpdate).toHaveBeenCalledTimes(1);
    expect(subUpdate.mock.calls[0][0].where).toEqual({ id: "sub_old" });
    // ห้ามแตะสิทธิ์เลยสักช่องทาง
    expect(grantUpdateMany).not.toHaveBeenCalled();
    expect(tgUpdateMany).not.toHaveBeenCalled();
    expect(revokeTradingViewAccess).not.toHaveBeenCalled();
    expect(removeGroupMember).not.toHaveBeenCalled();
  });

  it("ไม่มีแพ็กเกจอื่นเหลือ = ถอนสิทธิ์ตามปกติ (การ์ดต้องไม่กันของที่ควรถอน)", async () => {
    subFindFirst.mockResolvedValue(null);

    await expireSubscription(staleRow);

    expect(revokeTradingViewAccess).toHaveBeenCalledWith("glaiisarins");
    expect(grantUpdateMany).toHaveBeenCalled();
    expect(lastGrantData().status).toBe("PENDING_REVOKE");
  });
});

describe("ซ่อมคิวถอนที่จ่อคนที่ยังจ่ายเงินอยู่", () => {
  it("คืนคิวให้สิทธิ์ + ล้างตัวนับความล้มเหลวของรอบถอน", async () => {
    grantTable([{ id: "g1", userId: "u1", status: "PENDING_REVOKE", tv: "glaiisarins" }]);
    tgFindMany.mockResolvedValue([{ id: "t1" }]);

    const res = await healActiveMembersQueuedForRemoval();

    expect(res.grants).toBe(1);
    expect(res.telegram).toBe(1);
    expect(res.members).toEqual(["glaiisarins"]);

    const data = grantUpdateMany.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.revokedAt).toBeNull();
    // ไม่ล้างตัวนับ = ชนเพดาน MAX_FAILS ทันที แล้วไม่มีใครสั่งเพิ่มสิทธิ์ให้เลย
    expect(data.failCount).toBe(0);
    expect(data.lastFailReason).toBeNull();
  });

  it("ถอนไปแล้วจริงทั้งที่ยังจ่ายเงินอยู่ = คืนสิทธิ์ให้ด้วย", async () => {
    /**
     * ด่านที่ reconcile กันได้แค่งานที่ยังไม่สั่ง งานที่นั่งอยู่ในคิวบอทแล้วเรียกคืนไม่ได้
     * p_f123 จ่ายถึง 30 พ.ย. ต่ออายุตอนใบถอนค้างคิวอยู่ บอทถอนตามใบนั้นตอน 15:50
     */
    grantTable([{ id: "g9", userId: "u9", status: "REVOKED", tv: "p_f123" }]);

    const res = await healActiveMembersQueuedForRemoval();

    expect(res.grants).toBe(1);
    expect(res.members).toEqual(["p_f123"]);
    expect(grantUpdateMany.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("ใบล่าสุดยังใช้งานได้ = ไม่ต้องซ่อม (ใบเก่าที่ถอนไปแล้วไม่ใช่ปัญหา)", async () => {
    // grantTable คืนตามลำดับที่ใส่ และตัวซ่อมถือว่าใบแรกคือใบล่าสุด (orderBy createdAt desc)
    grantTable([
      { id: "new", userId: "u9", status: "GRANTED", tv: "p_f123" },
      { id: "old", userId: "u9", status: "REVOKED", tv: "p_f123" },
    ]);

    const res = await healActiveMembersQueuedForRemoval();

    expect(res.grants).toBe(0);
    expect(grantUpdateMany).not.toHaveBeenCalled();
  });

  it("ใบล่าสุดถูกถอน ทั้งที่มีใบ GRANTED เก่าอยู่ = ต้องซ่อม", async () => {
    /**
     * ใบเก่าของรอบบิลก่อนไม่ได้ให้สิทธิ์อะไรกับใครแล้ว ถ้าใบล่าสุดถูกถอน
     * ลูกค้าก็เข้าไม่ได้จริง ๆ — ของเดิมข้ามเคสนี้ไป
     * (p_f123 จ่ายถึง 30 พ.ย. แต่เข้าไม่ได้ทั้งวัน 3 พ.ย. 69)
     */
    grantTable([
      { id: "new", userId: "u9", status: "REVOKED", tv: "p_f123" },
      { id: "old", userId: "u9", status: "GRANTED", tv: "p_f123" },
    ]);

    const res = await healActiveMembersQueuedForRemoval();

    expect(res.grants).toBe(1);
    expect(grantUpdateMany.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("ไม่มีคิวที่ตั้งผิด = ไม่แตะอะไรเลย (ห้ามซ่อมมั่ว)", async () => {
    const res = await healActiveMembersQueuedForRemoval();

    expect(res).toEqual({ grants: 0, telegram: 0, members: [] });
    expect(grantUpdateMany).not.toHaveBeenCalled();
    expect(tgUpdateMany).not.toHaveBeenCalled();
  });
});
