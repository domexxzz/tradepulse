/**
 * เนื้อหาหน้า /guide — คู่มือตั้งค่าและแนวใช้งาน 3 ชุดอินดิเคเตอร์ (แก้ที่นี่ที่เดียว)
 *
 * ที่มา: ภาพหน้าชาร์ตจริง + การ์ดสรุปที่แคปจาก TradingView
 * ค่าตั้งทุกตัวถอดมาจากหน้าตั้งค่าจริงของอินดิเคเตอร์ ไม่ได้แต่งขึ้น
 *
 * ⚠️ ภาพและคลิปทั้งหมดบันทึกในโหมด Bar Replay ของ TradingView (ย้อนแท่งเทียนกลับมาเล่นซ้ำ)
 * เพื่อสาธิตการทำงาน ไม่ใช่บันทึกการเทรดสด — ห้ามพาดหัวว่าเป็นผลการเทรดจริง
 * ข้อความกำกับอยู่ที่ `mediaNote` ด้านล่าง ใช้ร่วมกันทั้งหน้า /guide และหน้าแรก
 *
 * หน้า /guide เคยมีคลิปวนซ้ำของแต่ละชุดคั่นระหว่างหน้าชาร์ตกับรายละเอียด
 * น็อตขอเอาออกวันที่ 30 ส.ค. 2026 — ตอนนี้เหลือเฉพาะภาพนิ่ง
 * ข้อมูลคลิปเดิมทั้งสี่ตัวและวิธีเข้ารหัสดูได้ที่ `git show 820dd84:src/config/guide.ts`
 * ไฟล์ .mp4 กับ poster ลบออกจาก public/ แล้วเมื่อ 30 ส.ค. 2026
 * ดึงคืนจาก git ได้: `git checkout b5255b6 -- public/videos/qvx-ict-sd.mp4`
 *
 * คลิป Hero เป็นคนละไฟล์ ยังใช้อยู่บนหน้าแรก อัดมาที่ 1718x584 ไม่ต้องครอป
 * เพราะไม่มี UI ของแอปติดมา เข้ารหัสด้วย -crf 24 -an (รายละเอียดอยู่ที่ heroClip ท้ายไฟล์)
 *
 * ไฟล์ poster สร้างจากคลิปตัวจริงเสมอ สัดส่วนจึงตรงกับ width/height ที่ส่งเข้า LoopingClip
 */

export const mediaNote =
  "ภาพและคลิปทั้งหมดบันทึกจากโหมด Bar Replay บน TradingView (XAUUSD) เพื่อสาธิตการทำงานของอินดิเคเตอร์ " +
  "ไม่ใช่บันทึกการเทรดสด และไม่ใช่คำแนะนำการลงทุน";

export interface GuideImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface GuideVideo {
  src: string;
  poster: string;
  label: string;
  /** ความยาวคลิปแบบอ่านง่าย เช่น "3:48" */
  duration: string;
  /**
   * ขนาดจริงของไฟล์ ใช้กันภาพกระโดด (CLS) ตอนคลิปยังไม่โหลด
   * ไม่ใส่ = ใช้ค่าเริ่มต้น 736x348 ใน LoopingClip ซึ่งเป็นสัดส่วนของคลิปคู่มือชุดเดิม
   * ตอนนี้เหลือ heroClip ตัวเดียวที่ใช้ชนิดนี้ และใส่ขนาดไว้แล้วเพราะอัดมากว้างกว่า
   */
  width?: number;
  height?: number;
}

export interface SettingGroup {
  group: string;
  items: string[];
}

export interface GuideSuite {
  /** ใช้เป็น anchor บนหน้า /guide */
  id: string;
  badge: string;
  name: string;
  tagline: string;
  /** เหมาะกับสไตล์ไหน — โชว์เป็นแถบสรุปบนสุดของแต่ละชุด */
  bestFor: string;
  timeframe: string;
  chart: GuideImage;
  /** สิ่งที่เห็นบนกราฟ */
  onChart: string[];
  /** ต้องเปิดฟังก์ชันอะไรบ้าง */
  enable: string[];
  /** ค่าตั้งสำคัญ แยกเป็นกลุ่มตามหน้าตั้งค่าจริง */
  settings: SettingGroup[];
  /** แนวใช้งานที่เวิร์ก */
  playbook: string[];
  /** ไม่เด่น / ต้องระวัง */
  cautions: string[];
  /** วิธีใช้ให้คุ้มที่สุด — เรียงเป็นขั้น */
  steps: string[];
  /** สรุปคีย์หลักหนึ่งบรรทัด */
  keyLine: string;
  /** การ์ดสรุปภาพ 3 ใบต่อชุด */
  cards: GuideImage[];
}

const smc: GuideSuite = {
  id: "smc",
  badge: "ชุด A",
  name: "SMC Unified Suite",
  tagline:
    "อ่านโครงสร้างตลาดแบบ Smart Money — โซน OB/FVG, Demand/Supply, Liquidity และ HTF 4H ในหน้าจอเดียว",
  bestFor: "Scalping / Intraday แบบ SMC",
  timeframe: "กราฟ 1–5 นาที · bias จาก HTF 4 ชั่วโมง",
  chart: {
    src: "/images/charts/smc-suite-v4.webp",
    alt: "หน้าชาร์ต XAUUSD ไทม์เฟรม 1 ชั่วโมง ที่เปิดชุด SMC Unified Suite แสดงโซน OB / FVG / RJB, โครงสร้าง HH/HL/LH/LL, BOS, CHoCH/MSS, เส้น Supertrend, EMA200 และป้ายราคาโซนถัดไป",
    width: 2280,
    height: 1144,
  },
  onChart: [
    "โครงสร้าง HH / HL / LH / LL",
    "ข้อความ BOS และ CHoCH / MSS",
    "โซน FVG",
    "โซน NEXT Supply / NEXT Demand",
    "จุดสภาพคล่อง LQ+ / LQ−",
    "ป้าย BUY",
  ],
  enable: [
    "Market Structure",
    "Order Block",
    "FVG",
    "Demand / Supply",
    "Liquidity sweep",
    "จุด pivot (liquidity pool)",
    "HTF trend align",
    "ฉายโซน OB/FVG จาก HTF ลงกราฟ",
    "Signal A: CHoCH + โซนแข็ง",
    "Signal B: แตะโซนแข็ง (scalp)",
    "NEXT Supply / Demand",
    "HH / HL / LH / LL",
  ],
  settings: [
    {
      group: "Liquidity / MTF / Confluence",
      items: [
        "Liquidity sweep = เปิด",
        "จุด pivot (liquidity pool) = เปิด",
        "Pivot Dynamic = เปิด",
        "Pivot liquidity = 5",
        "Dynamic สั้นสุด = 2 · ยาวสุด = 9",
        "ขนาดจุด (xATR) = 0.03",
        "จำนวน sweep ที่เก็บไว้ = 8",
        "เส้นยื่นจาก liquidity pool = เปิด",
        "จำนวนเส้น pool = 30 · ความยาวสูงสุด = 25",
        "ใช้ HTF trend align = เปิด",
        "ฉายโซน OB/FVG จาก HTF ลงกราฟ = เปิด",
        "HTF = 4 ชั่วโมง",
        "Base OB = 25 · FVG = 20 · SD = 20 · RJB = 15",
        "โซนซ้อนกัน (confluence) = 20",
      ],
    },
    {
      group: "Style / Zone",
      items: [
        "เปิดสีโซน OB / FVG / RJB",
        "Supply = สีส้ม · Demand = สีฟ้า",
        "Signal A และ Signal B = เปิด",
        "Cooldown = 10",
        "ความทึบโซน = 88 · ขอบกล่อง = 55",
        "โซนที่ราคาชนแล้วจางเป็นสีเทา",
        "ความทึบโซนที่ใช้แล้ว = 94",
      ],
    },
    {
      group: "Demand / Supply",
      items: [
        "เปิด Demand / Supply",
        "แรง impulse ขั้นต่ำ = 0.6",
        "ต้องมี imbalance (FVG) = เปิด",
        "SD เข้มข้นบน TF เล็ก (M1–M5) = เปิด",
        "TF เล็ก: แรง impulse = 1.6 · เว้นระยะโซน = 15",
        "จับโซนย่อยเมื่อโซนหลักอยู่ไกล = เปิด",
        "ถือว่าไกลเมื่อห่างกัน (xATR) = 3",
        "โซนย่อยสูงสุดต่อฝั่ง = 3",
        "ตัดโซนไกลเกินจากราคา = 20",
        "เส้น NEXT Supply / Demand = เปิด",
        "ความกว้างกล่อง = 4",
        "ความยาวเส้นราคาแรก = 18 · เหลื่อมทีละ = 3 · ยาวสุด = 60",
        "เปิด Rejection Block",
      ],
    },
    {
      group: "Market Structure / OB / FVG / Risk",
      items: [
        "แสดงเฉพาะโซน score สูง = เปิด",
        "โชว์ชื่อโซน ICT = เปิด",
        "ลบโซนที่ราคาทะลุแล้ว = เปิด",
        "ลบโซนทันทีเมื่อโดนเบรก = เปิด",
        "ความกว้างกล่องโซน = 4",
        "เปิด Market Structure · Swing length = 10",
        "จำนวน BOS/CHoCH ที่เก็บไว้ = 12",
        "HH / HL / LH / LL = เปิด",
        "เปิด Order Block · displacement ขั้นต่ำ (xATR) = 0",
        "ไม่สร้างโซนซ้อนทับของเดิม = เปิด (ถือว่าซ้อนเมื่อทับกัน > 30%)",
        "Pivot lookup = 1",
        "เปิด FVG",
        "SL (xATR) = 1.2",
      ],
    },
  ],
  playbook: ["Trend continuation", "Pullback to zone", "Sweep and reversal", "Zone reaction scalp"],
  cautions: [
    "ตลาดไซด์เวย์แคบ ๆ",
    "ช่วงข่าวแรงมาก",
    "เข้าไล่ราคาที่ไกลจากโซน",
    "เทรดสวน HTF 4H โดยไม่มีสัญญาณยืนยัน",
  ],
  steps: [
    "ดู bias จาก HTF 4 ชั่วโมง",
    "รอราคาเข้าโซน OB/FVG หรือ Demand/Supply",
    "รอ Liquidity sweep + CHoCH / BOS ยืนยัน",
    "รอสัญญาณ BUY หรือจังหวะ reaction",
    "ตั้ง SL ให้ชัดและจัดการความเสี่ยง",
  ],
  keyLine: "Liquidity + Market Structure + OB/FVG + Demand/Supply + HTF 4H",
  cards: [
    {
      src: "/images/guide/smc-enable.webp",
      alt: "การ์ดสรุปฟังก์ชันที่ต้องเปิดเพื่อให้ได้หน้าชาร์ตแบบชุด SMC Unified Suite",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/smc-settings.webp",
      alt: "การ์ดสรุปค่าตั้งสำคัญของชุด SMC Unified Suite",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/smc-style.webp",
      alt: "การ์ดสรุปแนวการเทรดที่เหมาะกับชุด SMC Unified Suite",
      width: 1100,
      height: 1100,
    },
  ],
};

const gold: GuideSuite = {
  id: "gold",
  badge: "ชุด B",
  name: "Gold Booster + Gold Core",
  tagline: "เทรดตามเทรนด์ด้วย Supertrend + EMA200 พร้อมป้าย BUY/SELL และ TP/SL คงที่ 500 จุด",
  bestFor: "Scalping / Intraday ตามเทรนด์",
  timeframe: "กราฟ 1–5 นาที · bias จาก HTF 4 ชั่วโมง",
  chart: {
    src: "/images/charts/gold-suite-snap-v4.webp",
    alt: "หน้าชาร์ต XAUUSD ที่เปิดชุด Gold Booster และ Gold Core แสดงเส้น Supertrend แบบขั้นบันได, เส้น EMA200, ป้าย BUY/SELL และ ICT BUY/ICT SELL, BOS, CHoCH/MSS, โซนราคา และระดับ NEXT SUPPLY / NEXT DEMAND",
    width: 2280,
    height: 1366,
  },
  onChart: [
    "ป้าย BUY / SELL ชัดเจน",
    "เส้น TP / SL แบบคงที่ 500 จุด",
    "เส้น Supertrend trail",
    "เส้น EMA200 ใช้เป็น bias",
    "ข้อความ BOS / CHoCH / MSS",
    "โซน OB / FVG / Supply / Demand ประกอบการเข้าเทรด",
  ],
  enable: [
    "HTF trend align",
    "ฉายโซน OB/FVG จาก HTF ลงกราฟ",
    "Signal A: CHoCH + โซนแข็ง (เข้า Gold Core)",
    "Signal B: แตะโซนแข็ง (scalp)",
    "Supertrend + dip-in-trend signal",
    "โซน DIP / RALLY",
    "เส้น Supertrend trail",
    "สัญญาณ Gold Core (scalping)",
    "เส้น EMA200",
    "เปิด short",
    "BUY/SELL ทุกสภาพตลาด",
    "Scalping: ใช้ TP/SL คงที่",
  ],
  settings: [
    {
      group: "MTF / Confluence",
      items: [
        "HTF = 4 ชั่วโมง",
        "Base OB = 25 · FVG = 20 · SD = 20 · RJB = 15",
        "โซนซ้อนกัน (confluence) = 20",
        "OB+FVG stacked = 20",
        "หลัง sweep = 20",
        "HTF align = 15",
        "Discount/Premium ถูกฝั่ง = 10",
        "คะแนนขั้นต่ำ (เข้ม/อิ่ม) = 55",
        "Cooldown = 10 แท่ง",
      ],
    },
    {
      group: "Style / Zone",
      items: [
        "เปิดสีโซน OB / FVG / RJB / Supply / Demand",
        "ความโปร่งใสโซน = 88 · ขอบกล่อง = 55",
        "โซนที่ราคาชนแล้วจางลงเป็นสีเทา",
        "ความโปร่งใสโซนที่ใช้แล้ว = 94",
      ],
    },
    {
      group: "Gold Booster",
      items: [
        "เปิด Supertrend + dip-in-trend signal",
        "Supertrend ATR = 10",
        "Supertrend Multiplier = 4.5",
        "RSI2 dip level = 8",
        "IBS max = 0.25",
        "โชว์โซน DIP / RALLY",
        "โชว์เส้น Supertrend trail",
      ],
    },
    {
      group: "Gold Core / Risk",
      items: [
        "เปิดสัญญาณ Gold Core (scalping)",
        "ใช้เส้น EMA200 · Trend EMA = 200",
        "EMA slope lookback = 50",
        "เปิด short · BUY/SELL ทุกสภาพตลาด",
        "Scalping ใช้ TP/SL คงที่",
        "TP คงที่ = 500 จุด · SL คงที่ = 500 จุด",
        "เว้นระยะสัญญาณ = 10",
        "SL (xATR) = 1.2",
        "TP1 = 1R · TP2 = 2R",
      ],
    },
  ],
  playbook: [
    "Trend-following scalp",
    "Pullback เข้าในเทรนด์",
    "Zone reaction trade",
    "Momentum continuation",
  ],
  cautions: [
    "ตลาดไซด์เวย์แคบ ๆ",
    "ช่วงข่าวแรงมาก",
    "เข้าไล่ราคาเมื่อห่าง EMA หรือโซนมากเกินไป",
    "สัญญาณถี่เกินไปโดยไม่ดู HTF bias",
  ],
  steps: [
    "ดู bias จาก HTF 4 ชั่วโมง",
    "รอโซน OB/FVG หรือ Demand/Supply",
    "เช็ก EMA200 + Supertrend ว่าไปทางเดียวกัน",
    "รอสัญญาณ BUY / SELL",
    "ตั้ง TP/SL แล้วคุมความเสี่ยง",
  ],
  keyLine: "EMA200 + Supertrend + OB/FVG + HTF 4H + TP/SL 500 จุด",
  cards: [
    {
      src: "/images/guide/gold-enable.webp",
      alt: "การ์ดสรุปฟังก์ชันที่ต้องเปิดเพื่อให้ได้หน้าชาร์ตแบบชุด Gold Booster และ Gold Core",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/gold-settings.webp",
      alt: "การ์ดสรุปค่าตั้งสำคัญของชุด Gold Booster และ Gold Core",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/gold-style.webp",
      alt: "การ์ดสรุปแนวการเทรดที่เหมาะกับชุด Gold Booster และ Gold Core",
      width: 1100,
      height: 1100,
    },
  ],
};

const ict: GuideSuite = {
  id: "ict",
  badge: "ชุด C",
  name: "ICT SD Signal",
  tagline:
    "สัญญาณ ICT BUY / ICT SELL ที่ต้องมี liquidity sweep ก่อน กรองด้วย EMA200 และล็อกเฉพาะช่วง London + NY",
  bestFor: "ICT / SMC Scalping – Intraday",
  timeframe: "กราฟ 1–5 นาที · เฉพาะ 14:00–23:00 น. (เวลาไทย)",
  chart: {
    src: "/images/charts/ict-suite-v4.webp",
    alt: "หน้าชาร์ต XAUUSD ที่เปิดชุด ICT SD Signal แสดงป้าย ICT BUY / ICT SELL, BOS, CHoCH/MSS, เส้นสภาพคล่อง, เส้น TP/SL และระดับ NEXT SUPPLY / NEXT DEMAND",
    width: 2280,
    height: 1108,
  },
  onChart: [
    "ป้าย ICT BUY และ ICT SELL",
    "โครงสร้าง HH / HL / LH / LL",
    "Liquidity sweep",
    "CHoCH / MSS และ BOS",
    "เส้น EMA200 ใช้เป็นฟิลเตอร์",
    "แผน TP1 และการเลื่อน SL ไป BE",
  ],
  enable: [
    "Market Structure",
    "HH / HL / LH / LL",
    "Liquidity sweep",
    "จุด pivot (liquidity pool)",
    "Pivot Dynamic",
    "ICT SD Signal",
    "ใช้ชื่อโซน ICT",
    "ลบโซนที่ทะลุแล้ว / ลบโซนเมื่อโดนเบรก",
    "ฟิลเตอร์ EMA200",
    "ใช้เฉพาะช่วง London + NY",
    "แผน TP1 + เลื่อน SL ไป BE",
  ],
  settings: [
    {
      group: "General / Structure",
      items: [
        "ATR length = 14 · 1 Point = 0.01",
        "โซนสูงสุด OB/FVG = 10 · Demand/Supply = 6 · RJB = 4",
        "ยืดโซนไปขวา = 6",
        "แสดงเฉพาะโซน score สูง (strong only) = เปิด",
        "ใช้ชื่อโซน ICT (OB/FVG/Demand/Supply/RJB) = เปิด",
        "ลบโซนที่ราคาแตะแล้ว (invalidated) = เปิด",
        "ลบโซนทันทีเมื่อโดนเบรก = เปิด",
        "ความกว้างกล่องโซน = 4 แท่ง",
        "เปิด Market Structure · Swing length = 10",
        "จำนวน BOS/CHoCH ที่เก็บไว้ = 12",
        "HH / HL / LH / LL = เปิด",
        "Order Block = ปิด · Rejection Block = ปิด",
      ],
    },
    {
      group: "Liquidity",
      items: [
        "Liquidity sweep = เปิด",
        "จุด pivot (liquidity pool) = เปิด",
        "Pivot แบบ Dynamic = เปิด",
        "Pivot สำหรับ liquidity = 5",
        "Dynamic สั้นสุด = 2 · ยาวสุด = 9",
        "ขนาดจุด (xATR) = 0.03",
        "จำนวน sweep ที่เก็บไว้ = 8",
        "เส้นยื่นจาก liquidity pool = เปิด",
        "จำนวนเส้น pool = 30 · ความยาวสูงสุด = 25 แท่ง",
        "ใช้ HTF trend align = ปิด",
        "ฉายโซน OB/FVG จาก HTF ลงกราฟ = ปิด",
        "HTF = 4 ชั่วโมง",
      ],
    },
    {
      group: "ICT SD Signal",
      items: [
        "เปิดสัญญาณ ICT SD",
        "แรง impulse โซน (xATR) = 0.6",
        "แท่งฐานใหญ่สุด (xATR) = 0.9",
        "SELL แพทเทิร์น: ชน NEXT SUPPLY แล้วถูกปฏิเสธ",
        "OB: แรง displacement (xATR) = 0.6",
        "เก็บโซนสูงสุด/ฝั่ง = 6 · อายุโซนสูงสุด = 200 แท่ง",
        "โซนกว้างสุด (xATR) = 1.5",
        "ต้องมีแท่งปฏิเสธยืนยัน = เปิด",
        "ต้องมี liquidity sweep ก่อน = เปิด (ภายใน 25 แท่ง)",
        "ตามเทรนด์ EMA เท่านั้น = เปิด · Trend EMA = 200",
        "เฉพาะ London + NY = เปิด · Session (เวลาไทย) = 14:00–23:00",
        "เว้นระยะสัญญาณ = 12 แท่ง",
        "ต้องย่อจริงก่อนเด้ง (RSI2) = เปิด · RSI2 เคยต่ำกว่า = 20 · มองย้อน 3 แท่ง",
        "SL เมื่อได้โซน (xATR) = 0.3",
        "แจ้งผล TP1 / TP2 HIT และ STOP LOSS = เปิด",
      ],
    },
    {
      group: "Plan / Trade Management",
      items: [
        "จำนวนแผนที่ติดตามพร้อมกัน = 20",
        "ชน TP1 → ปิดบางส่วน + เลื่อน SL มาที่ทุน (BE) = เปิด",
        "ปิดที่ TP1 = 50%",
        "หลัง TP1 ลาก SL ตามราคา (Trailing) = เปิด",
        "ระยะลาก SL (xATR) = 1.5",
      ],
    },
  ],
  playbook: [
    "Sweep + Reversal",
    "Zone reaction scalp",
    "ICT BUY continuation",
    "ICT SELL continuation",
  ],
  cautions: [
    "ตลาดไซด์เวย์แคบ ๆ",
    "นอกเวลา London + NY",
    "เข้าโดยไม่มี liquidity sweep",
    "เทรดสวน EMA200",
    "ไม่ยอมเลื่อน SL หลังได้ TP1",
  ],
  steps: [
    "ดู bias จาก EMA200",
    "รอ sweep / CHoCH / MSS",
    "รอสัญญาณ ICT BUY หรือ ICT SELL พร้อมโซนยืนยัน (OB/FVG/Demand/RJB)",
    "เข้าออเดอร์และตั้ง SL",
    "ชน TP1 แล้วเลื่อน SL ไป BE และบริหารต่อ",
  ],
  keyLine: "ICT SD Signal + Liquidity + Market Structure + EMA200 + TP1 / BE",
  cards: [
    {
      src: "/images/guide/ict-enable.webp",
      alt: "การ์ดสรุปฟังก์ชันที่ต้องเปิดเพื่อให้ได้หน้าชาร์ตแบบชุด ICT SD Signal",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/ict-settings.webp",
      alt: "การ์ดสรุปค่าตั้งสำคัญของชุด ICT SD Signal",
      width: 1100,
      height: 1100,
    },
    {
      src: "/images/guide/ict-style.webp",
      alt: "การ์ดสรุปแนวการเทรดที่เหมาะกับชุด ICT SD Signal ร่วมกับโซน SMC",
      width: 1100,
      height: 1100,
    },
  ],
};

export const guideSuites: GuideSuite[] = [smc, gold, ict];

/**
 * คลิปพระเอกบน Hero หน้าแรก — ไฟล์แยกจากคลิปในคู่มือ
 *
 * ตัดมาจากคลิป ICT + SMC ช่วง 95-145 วินาที ซึ่งเป็นช่วงที่โซนกับป้าย
 * BUY/SELL ขึ้นครบที่สุด และคลิปตัวนี้ไม่มีช่วงเปิดหน้าต่างตั้งค่าคั่นเลย
 *
 * ทำไมต้องแยกไฟล์แทนที่จะใช้ตัวเดียวกับในคู่มือ:
 *
 * Hero กว้าง ~1012px แต่ต้นฉบับอัดจอมาแค่ 736px คลิปเลยถูกเบราว์เซอร์ยืด
 * ด้วย bilinear ซึ่งทำให้ตัวหนังสือบนกราฟเบลอ ไฟล์นี้จึงเข้ารหัสไว้ที่
 * 1472x696 (2 เท่า) ด้วย lanczos + unsharp ให้เบราว์เซอร์ *ย่อ* ลงมาแทน
 * ที่จะขยาย — ขอบตัวอักษรคมขึ้นชัดเจน
 *
 * รายละเอียดที่ไม่มีในไฟล์ต้นฉบับสร้างขึ้นมาไม่ได้ ถ้าอยากได้คมกว่านี้อีก
 * ต้องอัดจอใหม่ที่ความละเอียดสูงกว่า 736px
 *
 * ที่ยอมจ่ายบิตให้ความละเอียดได้เพราะตัดเหลือ 50 วินาที — Hero loop ไม่มีใคร
 * ดูจนจบ 3 นาทีครึ่งอยู่แล้ว สุดท้ายไฟล์เล็กกว่าเดิม (3.5 MB จาก 6.4 MB)
 *
 * ffmpeg -ss 95 -t 50 -i <ต้นฉบับ> \
 *   -vf "crop=736:348:0:96,scale=1472:696:flags=lanczos,unsharp=5:5:0.8:5:5:0.0" \
 *   -c:v libx264 -preset slow -crf 30 -an -movflags +faststart
 *
 * รอบสอง (-v2) กดพื้นหลังให้เข้มเท่าภาพนิ่งทั้งเว็บ — bg 15 -> 8 เท่ากับภาพชุดอื่น
 * เข้ารหัสทับของที่ผ่านการบีบมาแล้ว จึงลด crf จาก 30 เป็น 26 กันไม่ให้ artifact
 * ในโทนมืดทับซ้อนกันจนเห็น (เส้นโค้งไปกดช่วงเดียวกับที่ artifact ของ h264 อยู่พอดี)
 * ผลลัพธ์ไฟล์เล็กลงด้วยซ้ำ 3.3 MB -> 2.8 MB เพราะภาพเข้มขึ้นบีบได้ดีกว่า
 * poster ปรับด้วยเส้นโค้งเดียวกันจากไฟล์ภาพเดิม ไม่ได้ดึงเฟรมใหม่ เฟรมจึงตรงกันแน่นอน
 *
 * ffmpeg -i qvx-hero.mp4 \
 *   -vf "curves=all='0/0 0.06/0.034 0.25/0.24 1/1'" \
 *   -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an -movflags +faststart \
 *   qvx-hero-v2.mp4
 *
 * (!) เปลี่ยนชื่อไฟล์ทุกครั้งที่เข้ารหัสใหม่ — เบราว์เซอร์กับ CDN แคชตาม URL
 */
export const heroClip: GuideVideo = {
  src: "/videos/qvx-hero-v2.mp4",
  poster: "/images/videos/qvx-hero-v2.webp",
  label: "อินดิเคเตอร์ QVX ทำงานบนกราฟ XAUUSD — ป้าย BUY/SELL, โซน และโครงสร้างตลาด",
  duration: "0:45",
  width: 1718,
  height: 584,
};

/** ขั้นตอนที่ใช้ร่วมกันทุกชุด — สรุปจากแนวใช้งานที่สอดคล้องกันของทั้งสามชุด */
export const sharedFlow: string[] = [
  "ดู bias จาก HTF หรือ EMA200",
  "รอราคาเข้าโซนสำคัญ เช่น OB / FVG / Demand / Supply",
  "รอ sweep / CHoCH / BOS / MSS หรือสัญญาณ BUY/SELL / ICT SD",
  "เข้าเทรดเมื่อมี confluence หลายอย่างตรงกัน",
  "ตั้ง SL ชัดเจน และบริหาร TP1 / TP2 / BE",
];

/** ข้อควรระวังที่ใช้ร่วมกันทุกชุด */
export const sharedCautions: string[] = [
  "ไม่เหมาะกับตลาดไซด์เวย์แคบ",
  "ระวังช่วงข่าวแรง",
  "ไม่ควรเข้าไล่ราคาไกลจากโซน",
  "ใช้เพื่อการศึกษาและฝึกวางแผน ไม่ใช่คำแนะนำการลงทุน",
];
