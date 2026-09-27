import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { KnowledgeIndex } = await import("@/lib/ai/rag");
const { buildCorpus } = await import("@/lib/ai/corpus");

const promo = { seats: 300, taken: 12, remaining: 288, active: true, monthlyTHB: 999 };
const index = new KnowledgeIndex(buildCorpus(promo));
const top = (q: string) => index.search(q, 4).map((r) => r.doc.id);

/**
 * คำถามจริงที่ลูกค้าน่าจะถาม — ชิ้นที่ถูกต้องต้องติดอันดับต้น ๆ
 * ถ้าค้นผิด AI จะตอบจากความรู้ทั่วไปแทนข้อมูลของ QVX (หรือแย่กว่านั้น เดาเอง)
 */
describe("RAG ค้นเจอชิ้นที่ถูก", () => {
  const cases: Array<[string, string]> = [
    ["FVG คืออะไร", "fvg"],
    ["ออเดอร์บล็อกใช้ยังไง", "order-block"],
    ["ทำไมกลางคืนไม่มีป้าย ICT", "ict-signal"],
    ["สัญญาณ scalping เกิดจากอะไร", "gold-core"],
    ["ชน TP1 แล้วต้องทำอะไร เลื่อน SL ยังไง", "plan-tp-sl"],
    ["ชน TP1 แล้วต้องทำอะไรต่อ", "plan-tp-sl"],
    ["BE คืออะไร", "plan-tp-sl"],
    ["ราคาสมาชิกเท่าไหร่", "pricing"],
    ["เปิดบัญชี wisdom ต้องฝากขั้นต่ำเท่าไหร่", "wisdom"],
    ["ขอคืนเงินได้ไหม", "refund"],
    ["อินดิเคเตอร์ repaint ไหม", "repaint-timeframe|faq-3"],
    ["CHoCH กับ BOS ต่างกันยังไง", "choch"],
    ["ตัวเลขคะแนนหลังชื่อโซนหมายถึงอะไร", "zone-score"],
    ["กรอก tradingview username ตรงไหน", "get-access"],
    ["ห้องสัญญาณ telegram มี timeframe อะไรบ้าง", "alerts-telegram"],
    ["liquidity sweep คืออะไร", "liquidity"],
    ["ai ถามได้กี่คำถามต่อเดือน", "qvx-ai"],
  ];
  for (const [q, id] of cases) {
    it(`"${q}" → ${id}`, () => {
      // "a|b" = ชิ้นไหนก็ถูก (เช่นคำถาม repaint ตอบได้ทั้งจาก FAQ และชิ้น repaint)
      const got = top(q).slice(0, 2);
      expect(id.split("|").some((x) => got.includes(x)), `got ${got.join(",")}`).toBe(true);
    });
  }
});

describe("ข้อมูลที่ดึงสดจากเว็บ", () => {
  it("ราคาตรงกับโปรที่เหลืออยู่จริง", () => {
    const pricing = buildCorpus(promo).find((d) => d.id === "pricing")!;
    expect(pricing.text).toContain("999 บาท");
    expect(pricing.text).toContain("เหลือ 288 ที่นั่ง");
  });

  it("โปรเต็มแล้ว = ราคาปกติ ไม่มีคำว่าเหลือที่นั่ง", () => {
    const full = buildCorpus({ ...promo, remaining: 0, active: false, monthlyTHB: 1290 }).find((d) => d.id === "pricing")!;
    expect(full.text).toContain("1,290 บาท");
    expect(full.text).toContain("เต็มแล้ว");
  });

  it("เงื่อนไข Wisdom มาจาก config เดียวกับหน้าเว็บ", () => {
    const w = buildCorpus(promo).find((d) => d.id === "wisdom")!;
    expect(w.text).toContain("100 USD");
    expect(w.text).toContain("MT5");
  });
});

describe("กฎของคลังความรู้", () => {
  it("ไม่มีตัวเลขผลงาน/backtest หลุดเข้าไป", () => {
    const all = buildCorpus(promo).map((d) => `${d.title} ${d.text}`).join("\n");
    expect(all).not.toMatch(/win ?rate|อัตราชนะ|\bWR\b|\bPF\b|backtest|กำไร\s*\d/i);
  });

  it("คำถามที่ไม่เกี่ยวเลยไม่ดึงอะไรมา (ไม่ยัดข้อมูลมั่ว)", () => {
    expect(index.search("สูตรทำต้มยำกุ้ง", 4, 0.12)).toHaveLength(0);
  });
});
