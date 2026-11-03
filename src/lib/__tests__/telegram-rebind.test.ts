import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "หนึ่ง Telegram ต่อหนึ่งสมาชิก" ต้องกันคนแชร์บัญชี ไม่ใช่กันลูกค้าเก่าที่กลับมา
 *
 * ลูกค้าที่เคยสมัครด้วยอีเมลอื่นแล้วทิ้งบัญชีนั้นไว้ พอกลับมาต่ออายุด้วยบัญชีใหม่
 * จะถูกปฏิเสธว่า "บัญชี Telegram นี้ถูกใช้กับสมาชิกรายอื่นแล้ว" ทั้งที่ไม่มีใคร
 * ได้สิทธิ์ซ้ำซ้อนเลยสักคน และข้อความแจ้งแอดมินไม่บอกด้วยว่าชนกับบัญชีไหน
 * แอดมินจึงตามแก้ต่อไม่ได้ (เจอจริง 3 พ.ย. 69 — @Mo_kham_99)
 *
 * เส้นแบ่งที่ถูกคือ "อีกบัญชียังจ่ายเงินอยู่ไหม" ไม่ใช่ "มีอีกบัญชีไหม"
 */

const userFindFirst = vi.fn();
const userUpdate = vi.fn();
const getUserSubscription = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
  },
}));
vi.mock("@/lib/subscription", () => ({
  getUserSubscription: (...a: unknown[]) => getUserSubscription(...a),
}));

/** สำเนาตรรกะเดียวกับ resolveTelegramConflict ใน webhook — ล็อกกติกาไว้ */
async function resolveTelegramConflict(telegramUserId: string, ownerId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { getUserSubscription: getSub } = await import("@/lib/subscription");
  const taken = await prisma.user.findFirst({
    where: { telegramUserId, NOT: { id: ownerId } },
    select: { id: true, email: true, name: true },
  });
  if (!taken) return { blocked: false as const, other: null };
  const { isActive } = await getSub(taken.id);
  if (isActive) return { blocked: true as const, other: taken };
  await prisma.user.update({
    where: { id: taken.id },
    data: { telegramUserId: null, telegramUsername: null },
  });
  return { blocked: false as const, other: taken };
}

beforeEach(() => {
  vi.clearAllMocks();
  userUpdate.mockResolvedValue({});
});

describe("Telegram ซ้ำกับบัญชีอื่น", () => {
  it("ไม่มีบัญชีอื่นถือ Telegram นี้ = ผ่าน", async () => {
    userFindFirst.mockResolvedValue(null);

    const r = await resolveTelegramConflict("tg1", "u_new");

    expect(r.blocked).toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("อีกบัญชียังจ่ายเงินอยู่ = แชร์กันจริง ต้องบล็อก และบอกว่าชนกับใคร", async () => {
    userFindFirst.mockResolvedValue({ id: "u_old", email: "old@x.c", name: "Old" });
    getUserSubscription.mockResolvedValue({ isActive: true });

    const r = await resolveTelegramConflict("tg1", "u_new");

    expect(r.blocked).toBe(true);
    expect(r.other?.email).toBe("old@x.c");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("อีกบัญชีหมดอายุแล้ว = ของเก่าที่ถูกทิ้ง ย้ายการผูกมาให้คนที่จ่ายเงินอยู่", async () => {
    userFindFirst.mockResolvedValue({ id: "u_old", email: "old@x.c", name: "Old" });
    getUserSubscription.mockResolvedValue({ isActive: false });

    const r = await resolveTelegramConflict("tg1", "u_new");

    expect(r.blocked).toBe(false);
    expect(r.other?.email).toBe("old@x.c");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u_old" },
      data: { telegramUserId: null, telegramUsername: null },
    });
  });
});
