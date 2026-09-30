import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ทวงคนที่จ่ายเงินแล้วแต่ยังไม่กรอก TradingView username
 *
 * เป็นขั้นตอนเดียวที่ทำแทนลูกค้าไม่ได้ ไม่กรอกคือจ่ายแล้วไม่ได้ของ
 * เทสต์นี้ล็อกสองเรื่องที่พลาดแล้วเจ็บคนละแบบ:
 *   ทวงน้อยไป = ลูกค้าค้างเป็นเดือนแบบที่เจอจริง 30 ก.ย. 69 (5 คน)
 *   ทวงมากไป = โดนกดสแปม แล้วอีเมลอื่นของเราพลอยเข้า junk ไปด้วย
 */

const findMany = vi.fn();
const count = vi.fn();
const update = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) },
    user: { update: (...a: unknown[]) => update(...a) },
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { remindMissingTradingView } = await import("@/lib/lifecycle");

const NOW = new Date("2026-09-30T10:00:00Z");
const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub1",
  planCode: "MONTH",
  currentPeriodEnd: new Date("2026-10-30T00:00:00Z"),
  user: { id: "u1", email: "a@b.test", name: "เบส" },
  ...over,
});

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  count.mockResolvedValue(0);
  update.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true });
});

describe("remindMissingTradingView", () => {
  it("ส่งอีเมลแล้วนับครั้งที่ทวงเพิ่ม", async () => {
    findMany.mockResolvedValue([sub()]);
    const r = await remindMissingTradingView(NOW);

    expect(r.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].to).toBe("a@b.test");
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { tvRemindedAt: NOW, tvRemindCount: { increment: 1 } },
    });
  });

  it("อีเมลต้องพาไปหน้ากรอกชื่อ ไม่ใช่หน้าบัญชีเฉย ๆ", async () => {
    findMany.mockResolvedValue([sub()]);
    await remindMissingTradingView(NOW);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.html).toContain("/account/tradingview");
    expect(mail.text).toContain("/account/tradingview");
  });

  it("ส่งไม่ออก = ยังไม่นับว่าทวงแล้ว จะได้ทวงใหม่เมื่อระบบอีเมลกลับมา", async () => {
    findMany.mockResolvedValue([sub()]);
    sendEmail.mockResolvedValue({ ok: false, reason: "no api key" });

    const r = await remindMissingTradingView(NOW);
    expect(r.sent).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("คนหนึ่งพังไม่ทำให้คนที่เหลือไม่ได้รับ", async () => {
    findMany.mockResolvedValue([
      sub({ id: "s1", user: { id: "u1", email: "a@b.test", name: null } }),
      sub({ id: "s2", user: { id: "u2", email: "c@d.test", name: null } }),
    ]);
    sendEmail.mockRejectedValueOnce(new Error("พัง")).mockResolvedValue({ ok: true });

    expect((await remindMissingTradingView(NOW)).sent).toBe(1);
  });

  it("เงื่อนไขค้นหากันสแปม — ทวงครบแล้วไม่เอาอีก และเว้นจังหวะจากครั้งล่าสุด", async () => {
    findMany.mockResolvedValue([]);
    await remindMissingTradingView(NOW);

    const where = findMany.mock.calls[0][0].where;
    expect(where.user.tradingViewUsername).toBeNull();
    expect(where.user.tvRemindCount).toEqual({ lt: 4 });
    // ยังไม่เคยทวง หรือ ทวงครั้งล่าสุดผ่านมาแล้ว 3 วัน
    expect(where.user.OR).toHaveLength(2);
    expect(where.user.OR[0]).toEqual({ tvRemindedAt: null });
    const gap = NOW.getTime() - where.user.OR[1].tvRemindedAt.lt.getTime();
    expect(gap).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("นับคนที่ยังไม่กรอกแยกจากคนที่ทวงรอบนี้ — ทวง 0 ไม่ได้แปลว่าไม่มีใครค้าง", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(5);

    const r = await remindMissingTradingView(NOW);
    expect(r.sent).toBe(0);
    expect(r.pending).toBe(5);
  });

  it("เพิ่งจ่ายเสร็จยังไม่ทวง — ให้เวลาเขาทำเองก่อน 1 วัน", async () => {
    findMany.mockResolvedValue([]);
    await remindMissingTradingView(NOW);

    const where = findMany.mock.calls[0][0].where;
    const gap = NOW.getTime() - where.createdAt.lt.getTime();
    expect(gap).toBe(24 * 60 * 60 * 1000);
  });
});
