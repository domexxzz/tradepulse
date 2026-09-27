import { describe, it, expect, vi } from "vitest";

// ไฟล์เหล่านี้ import prisma ตอนโหลด — เทสต์นี้ไม่ใช้ฐานข้อมูล
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { monthStartBangkok, nextMonthStartBangkok, conversationTitle } = await import("@/lib/ai/chat");
const { extractAnswer } = await import("@/lib/ai/openai");
const { parseSnapshot } = await import("@/lib/ai/market");
const { QVX_INSTRUCTIONS } = await import("@/lib/ai/instructions");

describe("โควตารายเดือนตามเวลาไทย", () => {
  it("ตี 1 วันที่ 1 ตามเวลาไทย (ยังเป็นวันที่ 30 ใน UTC) นับเป็นเดือนใหม่แล้ว", () => {
    const now = new Date("2026-09-30T18:00:00Z"); // = 1 ต.ค. 01:00 เวลาไทย
    expect(monthStartBangkok(now).toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("ห้าทุ่มคืนสิ้นเดือนตามเวลาไทย ยังเป็นเดือนเดิม", () => {
    const now = new Date("2026-09-30T16:00:00Z"); // = 30 ก.ย. 23:00 เวลาไทย
    expect(monthStartBangkok(now).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("ข้ามปีได้ — ธันวาคมรีเซ็ตเป็น 1 ม.ค. ปีถัดไป", () => {
    expect(nextMonthStartBangkok(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });
});

describe("อ่านคำตอบจาก OpenAI", () => {
  it("ใช้ output_text ถ้ามี", () => {
    expect(extractAnswer({ output_text: "  ตอบ  " })).toBe("ตอบ");
  });

  it("ไม่มี output_text (REST ตรง) ประกอบจาก output[].content[] แทน", () => {
    expect(
      extractAnswer({
        output: [
          { content: [{ type: "reasoning", text: "ห้ามโผล่" }] },
          { content: [{ type: "output_text", text: "ส่วนแรก " }, { type: "output_text", text: "ส่วนสอง" }] },
        ],
      })
    ).toBe("ส่วนแรก ส่วนสอง");
  });

  it("ว่างเปล่า = สตริงว่าง ให้ฝั่งเรียกถือว่าล้ม", () => {
    expect(extractAnswer({})).toBe("");
  });
});

describe("ข้อมูลตลาดจาก TradingView", () => {
  const now = Date.parse("2026-09-27T03:00:00Z");
  const valid = () => ({
    token: "ความลับ",
    schema_version: 1,
    event: "market_snapshot",
    symbol: "xauusd",
    ticker_id: "oanda:xauusd",
    exchange: "oanda",
    chart_tf: "m30",
    bar_time: now - 30 * 60_000,
    bar_close_time: now,
    confirmed: false,
    qvx: { zones: [] },
    timeframes: { M5: { o: 1, h: 2, l: 0.5, c: 1.5, v: 10, ema20: null, ema50: 1, rsi14: 55, atr14: 0.2, trend: 1 } },
  });

  it("รับแท่งที่ยังไม่ปิดด้วย — ตัวส่งบน TradingView ส่งทุก ~20 วินาทีระหว่างแท่งวิ่ง", () => {
    const s = parseSnapshot(valid(), now);
    expect(s?.confirmed).toBe(false);
    expect(s?.tickerId).toBe("OANDA:XAUUSD");
  });

  it("ไม่เก็บ token ที่มากับ body", () => {
    expect(JSON.stringify(parseSnapshot(valid(), now))).not.toContain("ความลับ");
  });

  it("ปฏิเสธข้อมูลเก่าเกิน 7 วัน หรือเวลาจากอนาคต", () => {
    expect(parseSnapshot({ ...valid(), bar_close_time: now - 8 * 86_400_000 }, now)).toBeNull();
    expect(parseSnapshot({ ...valid(), bar_close_time: now + 60 * 60_000 }, now)).toBeNull();
  });

  it("ปฏิเสธ timeframe แปลก ๆ หรือค่าไม่ใช่ตัวเลข", () => {
    expect(parseSnapshot({ ...valid(), timeframes: { W1: valid().timeframes.M5 } }, now)).toBeNull();
    expect(parseSnapshot({ ...valid(), timeframes: { M5: { ...valid().timeframes.M5, c: "1.5" } } }, now)).toBeNull();
    expect(parseSnapshot({ ...valid(), timeframes: { M5: { ...valid().timeframes.M5, trend: 2 } } }, now)).toBeNull();
  });

  it("ปฏิเสธ schema อื่น", () => {
    expect(parseSnapshot({ ...valid(), schema_version: 2 }, now)).toBeNull();
    expect(parseSnapshot({ ...valid(), event: "signal" }, now)).toBeNull();
  });
});

describe("ตัวตนของ QVX AI", () => {
  it("ยกคำสั่งของน็อตมาครบ — ส่วนที่กันการแต่งราคาต้องอยู่", () => {
    expect(QVX_INSTRUCTIONS).toContain("# Live market truthfulness");
    expect(QVX_INSTRUCTIONS).toContain("ห้ามสร้างราคาเอง");
  });

  it("ชื่อแชตตัดให้สั้นและเป็นบรรทัดเดียว", () => {
    expect(conversationTitle("CHoCH\nคืออะไร")).toBe("CHoCH คืออะไร");
    expect(conversationTitle("ก".repeat(100))).toHaveLength(58);
  });
});
