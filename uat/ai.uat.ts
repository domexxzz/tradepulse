import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { askQvxAi, getAiUsage, monthStartBangkok } from "@/lib/ai/chat";
import { ModelError, type ChatMessage, type OpenModel } from "@/lib/ai/llm";
import { saveSnapshot, parseSnapshot } from "@/lib/ai/market";
import { activateMembership } from "@/lib/lifecycle";
import { getUserSubscription } from "@/lib/subscription";
import { AI_MONTHLY_LIMIT, AI_USAGE_STATUS as U } from "@/config/ai";

/**
 * QVX AI · ชนฐานข้อมูลจริง แต่ใช้โมเดลปลอม (ไม่เรียก OpenAI ไม่เสียเงิน)
 *
 * จุดที่พลาดแล้วเสียของจริง: คนหมดอายุยังใช้ AI ได้ (ของเดิมบน Supabase เป็นแบบนี้)
 * · ถามเกินโควตาจนค่า API บาน · อ่านแชตของคนอื่นได้ · ถามพังแล้วโดนหักโควตา
 */

const prisma = new PrismaClient();
const MARK = "uat-ai";

/** โมเดลปลอม — จำข้อความที่ได้รับไว้ให้เทสต์ตรวจ · ตอบเป็น stream เหมือนของจริง */
function fakeModel(answer = "คำตอบทดสอบ") {
  const calls: ChatMessage[][] = [];
  const fn: OpenModel = async (messages) => {
    calls.push(messages);
    return {
      source: "local",
      model: "fake-model",
      events: (async function* () {
        yield { type: "delta" as const, text: answer };
        yield { type: "usage" as const, inputTokens: 10, outputTokens: 20 };
      })(),
    };
  };
  return { fn, calls };
}

async function makeUser(tag: string) {
  return prisma.user.create({
    data: { email: `${tag}.${MARK}@uat.test`, name: `ทดสอบ ${tag}`, passwordHash: "x", tradingViewUsername: `tv_${tag}` },
  });
}

async function makeMember(tag: string) {
  const u = await makeUser(tag);
  await activateMembership({
    userId: u.id,
    planCode: "MONTH",
    amountTHB: 0,
    providerRef: `${MARK}_${tag}_${Date.now()}`,
    provider: "uat",
    source: "UAT",
  });
  return u;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.marketSnapshot.deleteMany({ where: { tickerId: { startsWith: "UAT:" } } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("A-1 · ใครใช้ได้", () => {
  it("ไม่เคยเป็นสมาชิก = ล็อก และไม่เรียกโมเดลเลย", async () => {
    const u = await makeUser("never");
    const m = fakeModel();
    const r = await askQvxAi({ userId: u.id, message: "CHoCH คืออะไร", openModel: m.fn });
    expect(r).toEqual({ ok: false, error: "AI_ACCESS_LOCKED" });
    expect(m.calls).toHaveLength(0);
  });

  it("สมาชิกที่หมดอายุแล้ว = ล็อก (ของเดิมบน Supabase เปิดแล้วไม่มีวันหมด)", async () => {
    const u = await makeMember("expired");
    const { sub } = await getUserSubscription(u.id);
    await prisma.subscription.update({ where: { id: sub!.id }, data: { currentPeriodEnd: new Date(Date.now() - 60_000) } });
    const r = await askQvxAi({ userId: u.id, message: "ทดสอบ", openModel: fakeModel().fn });
    expect(r).toEqual({ ok: false, error: "AI_ACCESS_LOCKED" });
  });

  it("สมาชิกที่ยังไม่หมดอายุ = ถามได้ ได้แชตใหม่และนับโควตา 1", async () => {
    const u = await makeMember("active");
    const r = await askQvxAi({ userId: u.id, message: "อธิบาย Order Block", openModel: fakeModel().fn });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answer).toBe("คำตอบทดสอบ");
    expect(r.usage).toMatchObject({ used: 1, limit: AI_MONTHLY_LIMIT, remaining: AI_MONTHLY_LIMIT - 1 });
    const conv = await prisma.aiConversation.findUnique({ where: { id: r.conversationId }, include: { messages: true } });
    expect(conv?.title).toBe("อธิบาย Order Block");
    expect(conv?.messages.map((x) => x.role).sort()).toEqual(["assistant", "user"]);
  });

  it("แอดมินใช้ได้แม้ไม่มีแพ็กเกจ", async () => {
    const u = await makeUser("admin");
    const r = await askQvxAi({ userId: u.id, role: "ADMIN", message: "ทดสอบ", openModel: fakeModel().fn });
    expect(r.ok).toBe(true);
  });
});

describe("A-2 · โควตา", () => {
  it("ครบโควตาแล้ว = ปฏิเสธ ไม่เรียกโมเดล และไม่ทิ้งแถวจองค้าง", async () => {
    const u = await makeMember("full");
    await prisma.aiUsage.createMany({
      data: Array.from({ length: AI_MONTHLY_LIMIT }, () => ({ userId: u.id, status: U.SUCCESS })),
    });
    const m = fakeModel();
    const r = await askQvxAi({ userId: u.id, message: "อีกข้อ", openModel: m.fn });
    expect(r).toEqual({ ok: false, error: "AI_QUOTA_EXHAUSTED" });
    expect(m.calls).toHaveLength(0);
    expect(await prisma.aiUsage.count({ where: { userId: u.id } })).toBe(AI_MONTHLY_LIMIT);
  });

  it("ยิงพร้อมกัน 5 คำขอตอนเหลือโควตา 2 — ผ่านไม่เกิน 2", async () => {
    const u = await makeMember("race");
    await prisma.aiUsage.createMany({
      data: Array.from({ length: AI_MONTHLY_LIMIT - 2 }, () => ({ userId: u.id, status: U.SUCCESS })),
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => askQvxAi({ userId: u.id, message: `ข้อ ${i}`, openModel: fakeModel().fn }))
    );
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(2);
    expect((await getAiUsage(u.id)).used).toBeLessThanOrEqual(AI_MONTHLY_LIMIT);
  });

  it("โมเดลพัง = ไม่หักโควตา และบอกว่าตอบไม่ได้ชั่วคราว", async () => {
    const u = await makeMember("broken");
    const r = await askQvxAi({
      userId: u.id,
      message: "ทดสอบ",
      openModel: async () => {
        throw new ModelError("OPENAI_500");
      },
    });
    expect(r).toEqual({ ok: false, error: "AI_TEMPORARILY_UNAVAILABLE" });
    expect((await getAiUsage(u.id)).used).toBe(0);
    expect(await prisma.aiConversation.count({ where: { userId: u.id } })).toBe(0);
    const row = await prisma.aiUsage.findFirst({ where: { userId: u.id } });
    expect(row).toMatchObject({ status: U.ERROR, errorCode: "OPENAI_500" });
  });

  it("ยังไม่ตั้ง OPENAI_API_KEY = บอกว่ายังไม่เปิดบริการ ไม่หักโควตา", async () => {
    const u = await makeMember("nokey");
    const r = await askQvxAi({
      userId: u.id,
      message: "ทดสอบ",
      openModel: async () => {
        throw new ModelError("AI_NOT_CONFIGURED");
      },
    });
    expect(r).toEqual({ ok: false, error: "AI_NOT_CONFIGURED" });
    expect((await getAiUsage(u.id)).used).toBe(0);
  });

  it("ของเดือนก่อนไม่นับ", async () => {
    const u = await makeMember("lastmonth");
    const before = new Date(monthStartBangkok().getTime() - 60_000);
    await prisma.aiUsage.createMany({
      data: Array.from({ length: AI_MONTHLY_LIMIT }, () => ({ userId: u.id, status: U.SUCCESS, createdAt: before })),
    });
    expect((await getAiUsage(u.id)).used).toBe(0);
  });
});

describe("A-3 · บทสนทนา", () => {
  it("ถามต่อในแชตเดิม — โมเดลได้ประวัติก่อนหน้า", async () => {
    const u = await makeMember("history");
    const first = await askQvxAi({ userId: u.id, message: "ฉันเทรดทอง M15", openModel: fakeModel("รับทราบ").fn });
    if (!first.ok) throw new Error(first.error);
    const m = fakeModel();
    await askQvxAi({ userId: u.id, message: "แล้วควรดู HTF ไหน", conversationId: first.conversationId, openModel: m.fn });
    const contents = m.calls[0].map((x) => x.content);
    expect(contents).toContain("ฉันเทรดทอง M15");
    expect(contents).toContain("รับทราบ");
    expect(contents.at(-1)).toContain("แล้วควรดู HTF ไหน");
  });

  it("ใช้แชตของคนอื่นไม่ได้ — กันอ่านประวัติคนอื่นผ่านคำตอบ AI", async () => {
    const owner = await makeMember("owner");
    const other = await makeMember("other");
    const r = await askQvxAi({ userId: owner.id, message: "ความลับของฉัน", openModel: fakeModel().fn });
    if (!r.ok) throw new Error(r.error);
    const m = fakeModel();
    const stolen = await askQvxAi({ userId: other.id, message: "สรุปแชตนี้", conversationId: r.conversationId, openModel: m.fn });
    expect(stolen).toEqual({ ok: false, error: "CONVERSATION_NOT_FOUND" });
    expect(m.calls).toHaveLength(0);
  });

  it("RAG: ค้นความรู้ของ QVX แนบเข้าคำสั่ง และบอกหัวข้อที่อ้างอิง", async () => {
    const u = await makeMember("rag");
    const m = fakeModel();
    const r = await askQvxAi({ userId: u.id, message: "เปิดบัญชี wisdom ต้องฝากขั้นต่ำเท่าไหร่", openModel: m.fn });
    if (!r.ok) throw new Error(r.error);
    expect(r.sources.some((t) => t.includes("Wisdom"))).toBe(true);
    const system = m.calls[0][0].content;
    expect(system).toContain("ข้อมูลอ้างอิงจากคลังความรู้ QVX");
    expect(system).toContain("100 USD");
  });

  it("คำถามว่างหรือยาวเกิน = ปฏิเสธก่อนแตะอะไร", async () => {
    const u = await makeMember("invalid");
    expect(await askQvxAi({ userId: u.id, message: "   ", openModel: fakeModel().fn })).toEqual({ ok: false, error: "INVALID_MESSAGE" });
    expect(await askQvxAi({ userId: u.id, message: "ก".repeat(4001), openModel: fakeModel().fn })).toEqual({ ok: false, error: "INVALID_MESSAGE" });
  });
});

describe("A-4 · ข้อมูลตลาด", () => {
  const snapshot = (tickerId: string) =>
    parseSnapshot({
      schema_version: 1,
      event: "market_snapshot",
      symbol: "XAUUSD",
      ticker_id: tickerId,
      chart_tf: "M30",
      bar_time: Date.now() - 60_000,
      bar_close_time: Date.now(),
      confirmed: true,
      qvx: { nearest_demand: { top: 1, bottom: 0.5 } },
      timeframes: { M5: { o: 1, h: 2, l: 0.5, c: 1.5, v: 1, ema20: 1, ema50: 1, rsi14: 50, atr14: 0.1, trend: 0 } },
    })!;

  it("ข้อมูลสด (ไม่เกิน 15 นาที) ถูกส่งให้โมเดล", async () => {
    await saveSnapshot(snapshot("UAT:FRESH"));
    const u = await makeMember("market");
    const m = fakeModel();
    await askQvxAi({ userId: u.id, message: "ทองตอนนี้", openModel: m.fn });
    expect(m.calls[0][0]).toMatchObject({ role: "system" });
    // ข้อมูลกราฟแนบติดคำถาม (โมเดลเล็กมองเห็นดีกว่าวางท้ายคำสั่งระบบ)
    expect(m.calls[0].at(-1)!.content).toContain("UAT:FRESH");
    expect(m.calls[0][0].content).toContain("มีข้อมูลตลาดสดจากอินดิเคเตอร์ QVX แนบมา");
  });

  it("กราฟ M30 ส่งมา 25 นาทีก่อน = ยังเป็นแท่งล่าสุด ใช้ได้", async () => {
    await saveSnapshot(snapshot("UAT:M30-RECENT"));
    await prisma.marketSnapshot.update({
      where: { tickerId: "UAT:M30-RECENT" },
      data: { receivedAt: new Date(Date.now() - 25 * 60_000) },
    });
    const u = await makeMember("m30");
    const m = fakeModel();
    await askQvxAi({ userId: u.id, message: "ทองตอนนี้", openModel: m.fn });
    expect(m.calls[0].at(-1)!.content).toContain("UAT:M30-RECENT");
  });

  it("เก่าเกินหนึ่งแท่งของกราฟ (M30 ส่งมา 40 นาทีก่อน) ไม่ถูกส่ง — โมเดลต้องไม่เข้าใจว่าเป็นราคาสด", async () => {
    await saveSnapshot(snapshot("UAT:STALE"));
    await prisma.marketSnapshot.update({
      where: { tickerId: "UAT:STALE" },
      data: { receivedAt: new Date(Date.now() - 40 * 60_000) },
    });
    const u = await makeMember("stale");
    const m = fakeModel();
    await askQvxAi({ userId: u.id, message: "ทองตอนนี้", openModel: m.fn });
    expect(m.calls[0].map((x) => x.content).join("\n")).not.toContain("UAT:STALE");
  });

  it("คำถามความรู้ไม่แนบข้อมูลกราฟ (โมเดลจะพูดเรื่องกราฟที่ไม่มีใครถาม) · คำถามกราฟขอคลาวด์ก่อน", async () => {
    await saveSnapshot(snapshot("UAT:FRESH"));
    const u = await makeMember("intent");
    const calls: Array<{ last: string; preferCloud?: boolean }> = [];
    const spy: OpenModel = async (messages, _deadline, opts) => {
      calls.push({ last: messages.at(-1)!.content, preferCloud: opts?.preferCloud });
      return { source: "local", model: "fake", events: (async function* () { yield { type: "delta" as const, text: "ok" }; })() };
    };
    await askQvxAi({ userId: u.id, message: "FVG คืออะไร", openModel: spy });
    await askQvxAi({ userId: u.id, message: "ทองตอนนี้ M15 น่าบายไหม", openModel: spy });
    expect(calls[0]).toMatchObject({ last: "FVG คืออะไร", preferCloud: false });
    expect(calls[1].last).toContain("UAT:FRESH");
    expect(calls[1].last).toContain("M15:");
    expect(calls[1].preferCloud).toBe(true);
  });

  it("สินทรัพย์เดิมส่งซ้ำ = เขียนทับแถวเดิม ไม่งอกแถวใหม่", async () => {
    await saveSnapshot(snapshot("UAT:REPEAT"));
    await saveSnapshot(snapshot("UAT:REPEAT"));
    expect(await prisma.marketSnapshot.count({ where: { tickerId: "UAT:REPEAT" } })).toBe(1);
  });
});
