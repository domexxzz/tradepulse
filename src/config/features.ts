/** เนื้อหาเว็บทั้งหมด (แก้ที่นี่ที่เดียว) — อิงสเปกฟีเจอร์จริงของ QVX ไม่มีสถิติ/รีวิวปลอม */

export interface Feature {
  title: string;
  /** ใช้เป็น URL หน้า /features/[slug] — เปลี่ยนแล้วลิงก์เดิมจะพัง ระวังด้วย */
  slug: string;
  desc: string;
  howto: string;
  icon: string;
  image?: string; // ใส่ path screenshot จริงได้ เช่น "/images/features/fvg.png"
}

export const coreIntro =
  "QVX รวมเครื่องมืออ่านโครงสร้างราคา โซนสำคัญ และสัญญาณสำหรับวางแผนเทรดไว้ในอินดิเคเตอร์เดียว เพื่อช่วยให้ผู้ใช้เห็นบริบทของตลาดก่อนตัดสินใจ";

const coreFeaturesAll: Feature[] = [
  {
    title: "FVG — Fair Value Gap",
    slug: "fvg",
    icon: "SeparatorHorizontal",
    image: "/images/features/fvg-snap.webp",
    desc: "แสดงบริเวณที่ราคาเคลื่อนที่เร็วและทิ้งช่องว่างไว้ ใช้เฝ้าดูจังหวะที่ราคาอาจกลับมาทดสอบหรือเกิดปฏิกิริยา",
    howto: "รอให้ราคากลับเข้าใกล้โซน FVG แล้วดูโครงสร้างตลาดและสัญญาณยืนยันก่อนวางแผนเข้าเทรด",
  },
  {
    title: "OB — Order Block",
    slug: "order-block",
    icon: "Boxes",
    image: "/images/features/order-block.webp",
    desc: "แสดงโซนที่เคยเกิดแรงซื้อหรือแรงขายชัดเจน ใช้เป็นบริเวณสำคัญสำหรับเฝ้าดูการตอบสนองของราคา",
    howto: "เมื่อราคากลับมาที่โซน OB ให้รอพฤติกรรมราคาหรือสัญญาณยืนยัน ไม่ควรเข้าออเดอร์ทันทีเพียงเพราะราคาชนโซน",
  },
  {
    title: "LQ — Liquidity & Sweep",
    slug: "liquidity-sweep",
    icon: "Droplets",
    image: "/images/features/liquidity-sweep-snap.webp",
    desc: "ช่วยมองเห็นจุดสภาพคล่อง และจังหวะที่ราคากวาดระดับสำคัญก่อนกลับตัว",
    howto: "เมื่อเกิด Sweep ให้ใช้เป็นข้อมูลประกอบกับโซนใกล้เคียงและโครงสร้างตลาด เพื่อประเมินว่าราคาอาจมีแรงกลับหรือไม่",
  },
  {
    title: "DM-SP — Demand / Supply Zone",
    slug: "demand-supply-zone",
    icon: "LayoutGrid",
    image: "/images/features/demand-supply-zone-snap.webp",
    desc: "แสดง Demand Zone และ Supply Zone ซึ่งเป็นบริเวณที่ราคาเคยมีแรงซื้อหรือแรงขายเด่นชัด",
    howto: "ใช้ Demand Zone เพื่อเฝ้าหาจังหวะฝั่ง Buy และใช้ Supply Zone เพื่อเฝ้าหาจังหวะฝั่ง Sell โดยรอสัญญาณยืนยันเมื่อราคากลับเข้าโซน",
  },
  {
    title: "BOS — Break of Structure",
    slug: "break-of-structure",
    icon: "GitBranch",
    image: "/images/features/break-of-structure-snap.webp",
    desc: "แสดงเมื่อราคาทะลุโครงสร้างสำคัญ ช่วยให้เห็นว่าราคาอาจยังมีแรงเดินต่อในทิศทางเดิม",
    howto: "ใช้ BOS เพื่อยืนยันทิศทางตลาด แล้วรอราคาย่อกลับหาโซนสำคัญก่อนมองหาจังหวะเข้าเทรด",
  },
  {
    title: "CHoCH / MSS — Change of Character",
    slug: "change-of-character",
    icon: "Shuffle",
    image: "/images/features/change-of-character-snap.webp",
    desc: "แสดงเมื่อโครงสร้างราคาเริ่มเปลี่ยนไปจากทิศทางเดิม เป็นสัญญาณเตือนว่าตลาดอาจกำลังเปลี่ยนแนวโน้ม",
    howto: "หลังเกิด CHoCH ให้รอราคากลับมาทดสอบโซนสำคัญและมีสัญญาณยืนยัน ก่อนพิจารณาแผนในทิศทางใหม่",
  },
  {
    title: "Buy / Sell Scalping",
    slug: "buy-sell-scalping",
    icon: "Zap",
    image: "/images/features/buy-sell-scalping-snap.webp",
    desc: "สัญญาณ Buy / Sell สำหรับช่วยหาจังหวะเทรดระยะสั้นบนกราฟทองคำ โดยแสดงเมื่อระบบพบเงื่อนไขที่เข้าเกณฑ์",
    howto: "รอให้สัญญาณปรากฏหลังแท่งเทียนปิด แล้วตรวจสอบว่าอยู่ใกล้โซนสำคัญและสอดคล้องกับโครงสร้างตลาดก่อนเข้าเทรด",
  },
  {
    title: "ICT Buy",
    slug: "ict-buy",
    icon: "TrendingUp",
    image: "/images/features/ict-buy-snap.webp",
    desc: "สัญญาณ Buy ที่ช่วยค้นหาจังหวะเมื่อราคาแสดงแรงตอบสนองเชิงบวกจากบริเวณ Demand หรือโซนสำคัญ",
    howto: "ใช้เมื่อราคากลับมาที่ Demand Zone หรือ Bullish OB แล้วเกิด ICT Buy โดยกำหนดจุดตัดขาดทุนและเป้าหมายตามแผนที่ระบบแสดง",
  },
  {
    title: "ICT Sell",
    slug: "ict-sell",
    icon: "TrendingDown",
    image: "/images/features/ict-sell-snap.webp",
    desc: "สัญญาณ Sell ที่ช่วยค้นหาจังหวะเมื่อราคาแสดงแรงตอบสนองเชิงลบจากบริเวณ Supply หรือโซนสำคัญ",
    howto: "ใช้เมื่อราคากลับมาที่ Supply Zone หรือ Bearish OB แล้วเกิด ICT Sell โดยกำหนดจุดตัดขาดทุนและเป้าหมายตามแผนที่ระบบแสดง",
  },
];

export const advancedIntro =
  "สำหรับผู้ที่ต้องการปรับมุมมองและวิเคราะห์กราฟได้ลึกขึ้น QVX มีเครื่องมือเสริมที่เปิดใช้ตามสไตล์การเทรดของแต่ละคนได้";

const advancedToolsAll: Feature[] = [
  {
    title: "Supertrend",
    slug: "supertrend",
    icon: "Activity",
    image: "/images/features/supertrend-snap.webp",
    desc: "แสดงเส้นแนวโน้มบนกราฟเพื่อช่วยให้มองภาพรวมของราคาและจังหวะการเปลี่ยนทิศทางได้ชัดขึ้น",
    howto: "ใช้ดูทิศทางประกอบกับโครงสร้างตลาดและโซนสำคัญ ไม่ควรใช้เส้นแนวโน้มเพียงอย่างเดียวในการตัดสินใจเข้าเทรด",
  },
  {
    title: "EMA200",
    slug: "ema200",
    icon: "LineChart",
    image: "/images/features/ema200-snap.webp",
    desc: "แสดงเส้นแนวโน้มระยะยาวบนกราฟ เพื่อช่วยประเมินว่าราคาอยู่ในบริบทขาขึ้นหรือขาลง",
    howto: "ใช้เป็นภาพรวมประกอบสัญญาณ Scalping และโครงสร้างตลาด โดยให้ความสำคัญกับแผนที่สอดคล้องกับทิศทางใหญ่",
  },
  {
    title: "Higher Timeframe Alignment — HTF",
    slug: "htf-alignment",
    icon: "Layers",
    image: "",
    desc: "ใช้แนวโน้มและโซนจาก Timeframe ใหญ่เป็นข้อมูลประกอบการวิเคราะห์บน Timeframe ที่ใช้เข้าเทรด",
    howto: "ดูทิศทางของ TF ใหญ่ก่อน แล้วใช้โซนและสัญญาณบน TF เล็กเพื่อหาแผนที่สอดคล้องกัน",
  },
  {
    title: "Confluence Score",
    slug: "confluence-score",
    icon: "Gauge",
    image: "",
    desc: "ระบบให้คะแนนโซน 0-100 เพื่อช่วยจัดลำดับว่าโซนใดมีองค์ประกอบสนับสนุนหลายด้านมากกว่า",
    howto: "ให้ความสำคัญกับโซนคะแนนสูงร่วมกับโครงสร้างตลาดและสัญญาณยืนยัน คะแนนเป็นเพียงเครื่องมือช่วยคัดกรอง ไม่ใช่การรับประกันผลลัพธ์",
  },
  {
    title: "Zone Lifecycle",
    slug: "zone-lifecycle",
    icon: "RefreshCw",
    image: "",
    desc: "ติดตามสถานะของโซนว่าเป็นโซนใหม่ ถูกแตะ ถูกใช้งาน หรือเสียโครงสร้างแล้ว เพื่อให้กราฟเหลือข้อมูลที่ยังน่าติดตาม",
    howto: "โฟกัสโซนที่ยังใหม่หรือเพิ่งถูกแตะ และระวังโซนที่ราคาทะลุหรือถูกใช้งานไปแล้ว",
  },
  {
    title: "PPDD Order Block",
    slug: "ppdd-order-block",
    icon: "Boxes",
    image: "",
    desc: "แสดง Order Block ที่เกิดหลังการกวาด Liquidity เพื่อช่วยเน้นบริเวณที่มีบริบทด้านสภาพคล่องร่วมด้วย",
    howto: "ใช้เป็นตัวช่วยคัด OB ที่น่าสนใจขึ้น แล้วรอให้ราคากลับมามีปฏิกิริยาและมีสัญญาณยืนยันก่อนวางแผน",
  },
  {
    title: "High Volume Bar — HVB",
    slug: "high-volume-bar",
    icon: "BarChart3",
    image: "",
    desc: "เน้นแท่งเทียนที่มีปริมาณการซื้อขายเด่นกว่าปกติ เพื่อช่วยให้มองเห็นช่วงที่ตลาดมีแรงเข้ามาชัดเจน",
    howto: "ใช้สังเกตแรงของการเคลื่อนที่ โดยดูร่วมกับโซนและโครงสร้างตลาด ไม่ควรใช้ Volume Bar เพียงอย่างเดียวเพื่อเข้าเทรด",
  },
  {
    title: "Stacked OB + FVG",
    slug: "stacked-ob-fvg",
    icon: "Layers",
    image: "",
    desc: "แสดงบริเวณที่ Order Block และ Fair Value Gap เกิดร่วมกัน เพื่อช่วยให้เห็นโซนที่มีองค์ประกอบซ้อนกัน",
    howto: "ใช้เป็นจุดเฝ้าดูราคาเป็นพิเศษ แล้วรอสัญญาณยืนยันเมื่อราคากลับเข้ามาใกล้โซน",
  },
  {
    title: "Rejection Block — RJB",
    slug: "rejection-block",
    icon: "Ban",
    image: "/images/features/rejection-block.webp",
    desc: "แสดงบริเวณที่ราคาเกิดแรงปฏิเสธชัดเจนจากแท่งเทียน เพื่อใช้มองจุดที่แรงซื้อหรือแรงขายตอบสนองกลับ",
    howto: "ใช้ประกอบกับ Supply/Demand, Liquidity และโครงสร้างตลาด เพื่อประเมินว่าการปฏิเสธนั้นมีน้ำหนักมากพอหรือไม่",
  },
];

/**
 * แสดงเฉพาะฟีเจอร์ที่มี screenshot จริงแล้วเท่านั้น
 *
 * ของเดิมฟีเจอร์ที่ยังไม่มีรูปจะเรนเดอร์เป็นการ์ดภาพแบรนด์ พอวางเรียงปนกับการ์ด
 * ที่มีภาพกราฟจริงแล้วดูเหมือนของยังทำไม่เสร็จ จึงซ่อนไว้ก่อนจนกว่าจะแคปภาพมาใส่
 *
 * เนื้อหาของทั้ง 8 ตัวยังอยู่ครบในสองอาร์เรย์ด้านบน — พอใส่ image ให้ตัวไหน
 * ตัวนั้นจะกลับมาโผล่เองทั้งหน้าแรก หน้า /features และ sitemap ไม่ต้องแก้ที่อื่น
 */
const hasScreenshot = (f: Feature) => Boolean(f.image);

export const coreFeatures: Feature[] = coreFeaturesAll.filter(hasScreenshot);
export const advancedTools: Feature[] = advancedToolsAll.filter(hasScreenshot);

export const telegramInfo = {
  intro:
    "ไม่ต้องเฝ้ากราฟตลอดเวลา เมื่อระบบเกิดสัญญาณ Buy หรือ Sell ระบบสามารถส่งการแจ้งเตือนไปยัง Telegram เพื่อให้คุณติดตามโอกาสสำคัญได้ทันที (สิทธิ์เฉพาะสมาชิก)",
  signals: ["สัญญาณ Buy / Sell Scalping", "สัญญาณ ICT Buy / ICT Sell"],
  fields: ["ชื่อสินทรัพย์", "Timeframe", "ทิศทางสัญญาณ", "ราคาเข้า", "Stop Loss", "TP1", "TP2"],
  howto: "สมาชิกตั้งค่าการแจ้งเตือนตามคู่มือ แล้วรับข้อความผ่าน Telegram เมื่อระบบเกิดสัญญาณ Buy หรือ Sell",
};

export const benefits: string[] = [
  "อินดิเคเตอร์ครบทุกฟีเจอร์ ใช้งานบน TradingView",
  "สัญญาณ Buy / Sell พร้อม Entry, TP และ SL",
  "อัปเดตฟังก์ชันใหม่ตลอดอายุสมาชิก",
  "คู่มือและคลาสสอนการใช้งานระบบ",
  "ทีมช่วยเหลือเมื่อติดปัญหาการใช้งาน",
];

export interface Problem {
  problem: string;
  solution: string;
}
export const problems: Problem[] = [
  { problem: "สัญญาณจากหลายอินดิเคเตอร์ไม่ตรงกัน", solution: "รวมทุกเครื่องมือไว้ในระบบเดียว อ่านทิศทางจากชุดกฎเดียวกัน" },
  { problem: "ไม่รู้จุด Entry และจุดออกที่ชัดเจน", solution: "แสดง Entry, TP และ SL ให้เห็นบนกราฟตั้งแต่ก่อนเข้าเทรด" },
  { problem: "เข้าเทรดโดยไม่มีแผนบริหารความเสี่ยง", solution: "คำนวณขนาด Lot ตามความเสี่ยงที่ตั้งไว้ ช่วยให้เทรดมีวินัย" },
];

export interface Step {
  no: string;
  title: string;
  desc: string;
}
export const steps: Step[] = [
  { no: "1", title: "เปิดกราฟ XAUUSD บน TradingView", desc: "เพิ่มอินดิเคเตอร์ QVX เข้ากับกราฟทองคำที่คุณใช้อยู่" },
  { no: "2", title: "อ่าน Trend และสัญญาณ Entry", desc: "ดูทิศทางตลาดจากแถบสี และจังหวะเข้าจากสัญญาณของระบบ" },
  { no: "3", title: "วางแผน TP/SL และคุมความเสี่ยง", desc: "ตั้งเป้าทำกำไรและจุดตัดขาดทุน พร้อมกำหนดขนาด Lot ก่อนเข้าเทรด" },
];

export interface TrustItem {
  label: string;
  icon: string;
}
export const trustItems: TrustItem[] = [
  { label: "ออกแบบสำหรับ XAUUSD", icon: "Target" },
  { label: "ใช้งานบน TradingView", icon: "LineChart" },
  { label: "รวมเครื่องมือในหน้าจอเดียว", icon: "Layers" },
  { label: "มีคู่มือและทีมช่วยเหลือ", icon: "BookOpen" },
];

export interface Faq {
  q: string;
  a: string;
}
export const faqs: Faq[] = [
  { q: "ต้องมีบัญชี TradingView หรือไม่?", a: "ต้องมีครับ อินดิเคเตอร์ทำงานบนแพลตฟอร์ม TradingView หลังสมัครสมาชิกให้แจ้ง username เพื่อรับสิทธิ์ใช้งาน" },
  { q: "ใช้กับสินทรัพย์อะไรได้บ้าง?", a: "ออกแบบมาเพื่อทองคำ (XAUUSD) เป็นหลัก และใช้กับ Forex, Crypto หรือหุ้นได้ เพราะทำงานกับกราฟราคาทุกประเภทบน TradingView" },
  { q: "ใช้กับ Timeframe ไหน?", a: "ใช้ได้ทุกไทม์เฟรม แนะนำ M15 ขึ้นไปสำหรับการวางแผนที่ชัดเจน และดูภาพใหญ่จากไทม์เฟรมสูงร่วมด้วย" },
  { q: "อินดิเคเตอร์ Repaint หรือไม่?", a: "สัญญาณเข้าเทรดออกแบบให้ไม่ Repaint เมื่อเกิดสัญญาณแล้วใช้อ้างอิงได้ โดยยึดข้อมูลแท่งที่ปิดแล้วเป็นหลัก" },
  { q: "ติดตั้งและเริ่มใช้งานอย่างไร?", a: "สมัครสมาชิก แล้วแจ้ง TradingView username จากนั้นทีมงานจะเพิ่มสิทธิ์สคริปต์ให้ เมื่อได้รับสิทธิ์ก็เพิ่มอินดิเคเตอร์เข้ากราฟได้ทันที" },
  { q: "ยกเลิกสมาชิกได้หรือไม่?", a: "ยกเลิกได้ตามเงื่อนไขของแต่ละแพ็กเกจ โดยจัดการได้ในหน้าบัญชีของคุณ" },
  { q: "มีการรับประกันกำไรหรือไม่?", a: "ไม่มีการรับประกันผลกำไร QVX เป็นเครื่องมือช่วยวิเคราะห์และวางแผนเท่านั้น การเทรดมีความเสี่ยงและขึ้นกับการตัดสินใจของผู้ใช้" },
  { q: "ติดต่อทีมช่วยเหลือได้ทางไหน?", a: "ติดต่อทีมงานผ่านช่องทางที่ระบุในหน้าเว็บ ทีมงานพร้อมช่วยเหลือเรื่องการติดตั้งและการใช้งานระบบ" },
];

/* ------------------------------------------------------------------ */
/* หน้าฟีเจอร์รายตัว (/features/[slug])                                 */
/* ------------------------------------------------------------------ */

export type FeatureGroup = "core" | "advanced";

export interface FeatureEntry extends Feature {
  group: FeatureGroup;
  groupLabel: string;
}

/** ฟีเจอร์ทั้งหมดเรียงตามที่แสดงบนหน้าแรก */
export const allFeatures: FeatureEntry[] = [
  ...coreFeatures.map((f) => ({ ...f, group: "core" as const, groupLabel: "ระบบหลัก" })),
  ...advancedTools.map((f) => ({ ...f, group: "advanced" as const, groupLabel: "เครื่องมือขั้นสูง" })),
];

export function getFeatureBySlug(slug: string): FeatureEntry | undefined {
  return allFeatures.find((f) => f.slug === slug);
}
