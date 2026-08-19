/** เนื้อหาเว็บทั้งหมด (แก้ที่นี่ที่เดียว) — ไม่มีสถิติ/รีวิวปลอม */

export interface CoreFeature {
  title: string;
  desc: string;
  benefit: string;
  icon: string;
}

/** 6 ฟีเจอร์หลัก (โชว์เด่น) */
export const coreFeatures: CoreFeature[] = [
  {
    title: "Trend Following",
    desc: "ระบายแถบสีบอกทิศทางตลาด เขียวคือขาขึ้น แดงคือขาลง",
    benefit: "รู้ทิศทางหลักก่อนเข้า ลดการเทรดสวนเทรนด์",
    icon: "Activity",
  },
  {
    title: "Buy / Sell Signal",
    desc: "สัญญาณเข้าเทรดตามเทรนด์ ประมวลจากพฤติกรรมราคา",
    benefit: "เห็นจังหวะเข้าชัด ไม่ต้องเดาเอง",
    icon: "TrendingUp",
  },
  {
    title: "Entry / TP / SL",
    desc: "กำหนดจุดเข้า เป้าทำกำไร และจุดตัดขาดทุนให้ครบ",
    benefit: "มีแผนก่อนเข้า ตั้งเป้าและคุมความเสี่ยงได้ทันที",
    icon: "Target",
  },
  {
    title: "Market Structure",
    desc: "อ่านโครงสร้างตลาด BoS / CHoCH ว่าเทรนด์ต่อหรือกลับตัว",
    benefit: "เข้าใจบริบทตลาด ตัดสินใจบนโครงสร้างจริง",
    icon: "GitBranch",
  },
  {
    title: "Multi-Timeframe",
    desc: "รวมข้อมูลหลายไทม์เฟรมบนกราฟเดียว ไม่ต้องสลับจอ",
    benefit: "เห็นภาพใหญ่และจังหวะย่อยพร้อมกัน",
    icon: "Layers",
  },
  {
    title: "Risk Management",
    desc: "คำนวณขนาด Lot ตามความเสี่ยงที่กำหนดต่อการเทรด",
    benefit: "คุมความเสี่ยงเป็นระบบ ลดโอกาสล้างพอร์ต",
    icon: "ShieldCheck",
  },
];

export interface MoreFeature {
  title: string;
  desc: string;
  icon: string;
}

/** ฟีเจอร์ทั้งหมด (แสดงแบบ collapsible) */
export const moreFeatures: MoreFeature[] = [
  { title: "Support / Resistance", desc: "แนวรับ–แนวต้านอัตโนมัติแบบหลายไทม์เฟรม", icon: "Minus" },
  { title: "Order Block", desc: "ระบุโซนแรงซื้อ–ขายที่มักเป็นจุดกลับตัว", icon: "Boxes" },
  { title: "Supply / Demand Zone", desc: "หาโซนอุปสงค์–อุปทานจากหลายไทม์เฟรม", icon: "LayoutGrid" },
  { title: "Fair Value Gap (FVG)", desc: "ตรวจจับช่องว่างราคา บอกแรงของเทรนด์", icon: "SeparatorHorizontal" },
  { title: "Auto Fibonacci", desc: "วาด Fibonacci อัตโนมัติจาก Swing to Swing", icon: "Ruler" },
  { title: "Auto Trendline", desc: "วาดเส้นเทรนด์ไลน์อัตโนมัติ จับทิศทางแม่นยำ", icon: "PenLine" },
  { title: "VWAP Bias", desc: "บอกทิศทางราคาของวันจากค่าเฉลี่ยถ่วงน้ำหนักปริมาณ", icon: "Scale" },
  { title: "Volume Imbalance", desc: "ตรวจจับโซนที่ราคาเคลื่อนแรงผิดปกติ", icon: "BarChart3" },
  { title: "Market Session", desc: "ไฮไลต์ช่วงเวลาตลาด หา High/Low ของแต่ละ Session", icon: "Clock" },
  { title: "Real-Time Alert", desc: "แจ้งเตือนเมื่อเกิดสัญญาณ ไม่ต้องเฝ้าจอ", icon: "Bell" },
  { title: "Harmonic Pattern", desc: "ตรวจจับรูปแบบราคาเชิงเรขาคณิตอิง Fibonacci", icon: "Spline" },
  { title: "Auto Elliott Wave", desc: "นับคลื่น Elliott อัตโนมัติ แยก Impulse / Corrective", icon: "AudioWaveform" },
  { title: "Smooth Candle", desc: "ปรับแท่งเทียนให้อ่านง่ายขึ้น", icon: "CandlestickChart" },
  { title: "Sideway Detector", desc: "ตรวจจับภาวะไซด์เวย์แบบหลายไทม์เฟรม", icon: "MoveHorizontal" },
];

export interface Problem {
  problem: string;
  solution: string;
}

export const problems: Problem[] = [
  {
    problem: "สัญญาณจากหลายอินดิเคเตอร์ไม่ตรงกัน",
    solution: "รวมทุกเครื่องมือไว้ในระบบเดียว อ่านทิศทางจากชุดกฎเดียวกัน",
  },
  {
    problem: "ไม่รู้จุด Entry และจุดออกที่ชัดเจน",
    solution: "แสดง Entry, TP และ SL ให้เห็นบนกราฟตั้งแต่ก่อนเข้าเทรด",
  },
  {
    problem: "เข้าเทรดโดยไม่มีแผนบริหารความเสี่ยง",
    solution: "คำนวณขนาด Lot ตามความเสี่ยงที่ตั้งไว้ ช่วยให้เทรดมีวินัย",
  },
];

export interface Step {
  no: string;
  title: string;
  desc: string;
}

export const steps: Step[] = [
  { no: "1", title: "เปิดกราฟ XAUUSD บน TradingView", desc: "เพิ่มอินดิเคเตอร์ TradePulse เข้ากับกราฟทองคำที่คุณใช้อยู่" },
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

/** สิ่งที่ผู้ใช้จะได้รับ (แทนที่รีวิว เพราะยังไม่มีรีวิวจริง) */
export const benefits: string[] = [
  "อินดิเคเตอร์ครบทุกฟีเจอร์ ใช้งานบน TradingView",
  "สัญญาณ Buy / Sell พร้อม Entry, TP และ SL",
  "อัปเดตฟังก์ชันใหม่ตลอดอายุสมาชิก",
  "คู่มือและคลาสสอนการใช้งานระบบ",
  "ทีมช่วยเหลือเมื่อติดปัญหาการใช้งาน",
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
  { q: "มีการรับประกันกำไรหรือไม่?", a: "ไม่มีการรับประกันผลกำไร TradePulse เป็นเครื่องมือช่วยวิเคราะห์และวางแผนเท่านั้น การเทรดมีความเสี่ยงและขึ้นกับการตัดสินใจของผู้ใช้" },
  { q: "ติดต่อทีมช่วยเหลือได้ทางไหน?", a: "ติดต่อทีมงานผ่านช่องทางที่ระบุในหน้าเว็บ ทีมงานพร้อมช่วยเหลือเรื่องการติดตั้งและการใช้งานระบบ" },
];
