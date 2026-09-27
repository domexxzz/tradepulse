import { describe, it, expect, vi } from "vitest";

// ไฟล์เหล่านี้ import prisma ตอนโหลด — เทสต์นี้ไม่ใช้ฐานข้อมูล
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { monthStartBangkok, nextMonthStartBangkok, conversationTitle } = await import("@/lib/ai/chat");
const { extractAnswer } = await import("@/lib/ai/openai");
const { parseSnapshot, chartTfMinutes, snapshotMaxAgeMs } = await import("@/lib/ai/market");
const { QVX_KNOWLEDGE } = await import("@/lib/ai/knowledge");
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

describe("ข้อมูลสดแค่ไหน — ขึ้นกับ timeframe ของกราฟ", () => {
  it("อ่าน timeframe ได้ทั้งแบบ TradingView และแบบ M30/H1", () => {
    expect(chartTfMinutes("30")).toBe(30);
    expect(chartTfMinutes("240")).toBe(240);
    expect(chartTfMinutes("M30")).toBe(30);
    expect(chartTfMinutes("H1")).toBe(60);
    expect(chartTfMinutes("D")).toBe(1440);
    expect(chartTfMinutes("อะไร")).toBeNull();
  });

  it("กราฟ M30 ส่งทุก 30 นาที — ต้องใช้ได้ถึง 35 นาที ไม่ใช่ 15 (ไม่งั้น AI บอกไม่มีข้อมูลครึ่งหนึ่งของเวลา)", () => {
    expect(snapshotMaxAgeMs("30")).toBe(35 * 60_000);
  });

  it("กราฟเล็กยังใช้ได้อย่างน้อย 15 นาที · กราฟใหญ่ไม่เกิน 65 นาที · อ่านไม่ออกใช้ 15 นาที", () => {
    expect(snapshotMaxAgeMs("1")).toBe(15 * 60_000);
    expect(snapshotMaxAgeMs("240")).toBe(65 * 60_000);
    expect(snapshotMaxAgeMs("D")).toBe(65 * 60_000);
    expect(snapshotMaxAgeMs("???")).toBe(15 * 60_000);
  });

  it("payload หน้าตาเดียวกับที่อินดิเคเตอร์ QVX AI ส่งจริง ผ่านการตรวจ", () => {
    const tf = (c: number) => ({ o: c - 1, h: c + 1, l: c - 2, c, v: null, ema20: c, ema50: c, rsi14: 55.2, atr14: 1.1, trend: 0 });
    const now = Date.parse("2026-09-27T03:00:00Z");
    const payload = {
      token: "x", schema_version: 1, event: "market_snapshot",
      symbol: "XAUUSD", ticker_id: "OANDA:XAUUSD", exchange: "OANDA", chart_tf: "30",
      bar_time: now - 30 * 60_000, bar_close_time: now, confirmed: true,
      qvx: {
        structure_trend: 1, bos_up: false, bos_down: false, choch_up: true, choch_down: false,
        smc_buy: false, smc_sell: false, gold_buy: true, gold_sell: false, ict_buy: false, ict_sell: false,
        active_zone_kind: "OB", active_zone_direction: 1, active_zone_score: 72, active_zone_top: 2651.2, active_zone_bottom: 2648.9,
        nearest_supply: null, nearest_demand: 2648.9, liquidity_high: 2660, liquidity_low: 2640, sweep_high: false, sweep_low: true,
        zones: [{ kind: "FVG", direction: -1, state: "fresh", score: 64, top: 2662, bottom: 2659.5, origin_tf: "chart", touches: 0 }],
        liquidity_pools: [{ level: 2660, direction: 1 }],
      },
      timeframes: { M1: tf(1), M2: tf(2), M3: tf(3), M5: tf(5), M10: tf(10), M15: tf(15), M30: tf(30), H1: tf(60), H4: tf(240), D1: tf(1440) },
    };
    const s = parseSnapshot(JSON.parse(JSON.stringify(payload)), now);
    expect(s?.chartTf).toBe("30");
    expect(s?.exchange).toBe("OANDA");
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(64 * 1024);
  });
});

describe("ตัวตนของ QVX AI", () => {
  it("รู้จักฟีเจอร์ตามคู่มือ และไม่มีตัวเลขผลตอบแทน/อัตราชนะ", () => {
    for (const w of ["Gold Core", "ICT Buy", "Order Block", "TP1", "M5, M15, M30, H1"]) expect(QVX_KNOWLEDGE).toContain(w);
    // โค้ดอินดิเคเตอร์มีคอมเมนต์ผล backtest (WR/PF) — ห้ามหลุดมาเป็นคำโฆษณาของ AI
    expect(QVX_KNOWLEDGE).not.toMatch(/win ?rate|อัตราชนะ|\bWR\b|\bPF\b|backtest|กำไร\s*\d/i);
  });

  it("ยกคำสั่งของน็อตมาครบ — ส่วนที่กันการแต่งราคาต้องอยู่", () => {
    expect(QVX_INSTRUCTIONS).toContain("# Live market truthfulness");
    expect(QVX_INSTRUCTIONS).toContain("ห้ามสร้างราคาเอง");
  });

  it("ชื่อแชตตัดให้สั้นและเป็นบรรทัดเดียว", () => {
    expect(conversationTitle("CHoCH\nคืออะไร")).toBe("CHoCH คืออะไร");
    expect(conversationTitle("ก".repeat(100))).toHaveLength(58);
  });
});
