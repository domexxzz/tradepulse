/** เนื้อหาเว็บทั้งหมด (แก้ที่นี่ที่เดียว) — ไม่มีสถิติ/รีวิวปลอม */

export interface CoreFeature {
  title: string;
  desc: string;
  benefit: string;
  icon: string;
}

/** 6 ฟีเจอร์หลัก (โชว์เด่น) — ทุกข้อตรวจสอบแล้วว่ามีอยู่จริงใน Pine source */
export const coreFeatures: CoreFeature[] = [
  {
    title: "Confluence Score 0–100",
    desc: "ให้คะแนนทุกโซนจากปัจจัยที่ซ้อนกัน เช่น OB+FVG ทับกัน เกิดหลัง liquidity sweep หรือ HTF ไปทางเดียวกัน",
    benefit: "กรองเหลือเฉพาะโซนคะแนนสูง ไม่ต้องนั่งเดาว่าโซนไหนน่าเชื่อถือกว่ากัน",
    icon: "Calculator",
  },
  {
    title: "Zone Engine 4 ชนิด",
    desc: "ตรวจจับ Order Block, Fair Value Gap, Demand/Supply และ Rejection Block พร้อมกันบนกราฟเดียว",
    benefit: "เห็นโซนสำคัญครบทุกแบบ ไม่ต้องลงอินดิเคเตอร์หลายตัวซ้อนกัน",
    icon: "Boxes",
  },
  {
    title: "Zone Lifecycle",
    desc: "ติดตามสถานะทุกโซนว่ายังสด โดนแตะแล้ว ถูก mitigate หรือทะลุไปแล้ว และลบโซนที่หมดอายุอัตโนมัติ",
    benefit: "กราฟไม่รก เหลือเฉพาะโซนที่ยังใช้ได้จริง",
    icon: "Activity",
  },
  {
    title: "Gold Core Signal",
    desc: "สัญญาณ BUY/SELL เฉพาะทางทองคำ ผสม EMA200, Supertrend และการกรองความชันของเทรนด์",
    benefit: "สัญญาณที่จูนมาเพื่อ XAUUSD โดยตรง ไม่ใช่สูตรทั่วไปที่ยกมาใช้",
    icon: "TrendingUp",
  },
  {
    title: "Entry / TP1 / TP2 / SL",
    desc: "คำนวณจุดเข้า เป้าหมายสองชั้น และจุดตัดขาดทุนจาก ATR แล้ววาดเป็นแผนบนกราฟ",
    benefit: "มีตัวเลขครบก่อนกดเข้า ไม่ต้องคิดสดตอนตลาดวิ่ง",
    icon: "Target",
  },
  {
    title: "Telegram Alert",
    desc: "ส่งสัญญาณเข้า Telegram ผ่าน webhook เลือกได้ว่าจะแจ้งเฉพาะโซนคะแนนเท่าไหร่ขึ้นไป",
    benefit: "ไม่ต้องเฝ้าจอ สัญญาณเข้ามือถือทันทีที่เกิด",
    icon: "BellRing",
  },
];

export interface MoreFeature {
  title: string;
  desc: string;
  icon: string;
}

/** ฟีเจอร์ทั้งหมด (แสดงแบบ collapsible) — ตรงกับโมดูลจริงในสคริปต์ */
export const moreFeatures: MoreFeature[] = [
  { title: "Market Structure (BOS / CHoCH)", desc: "อ่านการเบรกโครงสร้างและการกลับตัว พร้อมป้าย HH / HL / LH / LL", icon: "GitBranch" },
  { title: "Order Block", desc: "จับโซน OB จากแรง displacement กรองโซนซ้อนทับและเว้นระยะได้", icon: "Boxes" },
  { title: "PPDD Order Block", desc: "เจาะจง OB ที่เกิดหลังกวาด liquidity ซึ่งมักเป็นจุดกลับตัวคุณภาพสูง", icon: "Target" },
  { title: "Fair Value Gap", desc: "ตรวจจับช่องว่างราคา กรองตามขนาดขั้นต่ำ และแยก FVG ที่เบรกโครงสร้าง", icon: "SeparatorHorizontal" },
  { title: "Demand / Supply Zone", desc: "หาโซนจากแรง impulse ปรับความเข้มอัตโนมัติบน TF เล็ก และจับโซนย่อยตอน pullback", icon: "LayoutGrid" },
  { title: "Rejection Block", desc: "จับแท่งที่มีไส้ยาวผิดปกติตามอัตราส่วน wick/body ที่ตั้งไว้", icon: "CandlestickChart" },
  { title: "Liquidity Sweep", desc: "ตรวจจับการกวาด liquidity pool พร้อม pivot แบบ dynamic ที่ปรับตามความผันผวน", icon: "Waves" },
  { title: "NEXT Supply / Demand", desc: "ชี้ระดับ swing ใกล้สุดที่ราคายังไปไม่ถึง จำไว้ตลอดไม่หายไปพร้อมโซน", icon: "Minus" },
  { title: "Multi-Timeframe", desc: "เช็ก trend ให้ตรงกับ HTF และฉายโซน OB/FVG จากไทม์เฟรมใหญ่ลงมาบนกราฟ", icon: "Layers" },
  { title: "Gold Booster", desc: "Supertrend ผสมสัญญาณซื้อย่อจาก RSI2 และ IBS พร้อมป้าย DIP / RALLY", icon: "Activity" },
  { title: "ICT SD Signal", desc: "ชุดสัญญาณสาย ICT พร้อมตัวกรองเวลาเทรดตาม Session เวลาไทย", icon: "Clock" },
  { title: "High Volume Bar", desc: "ระบายสีแท่งที่วอลุ่มสูงผิดปกติเทียบกับค่าเฉลี่ย", icon: "BarChart3" },
  { title: "Stacked OB + FVG", desc: "ทำเครื่องหมายจุดที่ OB กับ FVG ซ้อนกัน สัญญาณโมเมนตัมแรง", icon: "Table" },
  { title: "Plan Tracking", desc: "ติดตามแผนเทรดที่เปิดอยู่ พร้อมอัปเดต SL/TP ให้อัตโนมัติเมื่อสถานการณ์เปลี่ยน", icon: "Scale" },
  { title: "Retest Alert", desc: "แจ้งเตือนเมื่อราคากลับมาชนโซนเดิมซ้ำ ไม่พลาดจังหวะรอบสอง", icon: "Bell" },
  { title: "ปรับแต่งการแสดงผล", desc: "ตั้งสี ความโปร่งใส และให้ความทึบของโซนแปรตามคะแนน confluence", icon: "Palette" },
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
    solution: "กำหนด SL และ TP สองชั้นจาก ATR ให้ตั้งแต่ตอนเกิดสัญญาณ รู้ระยะเสี่ยงก่อนเข้า",
  },
];

export interface Step {
  no: string;
  title: string;
  desc: string;
}

export const steps: Step[] = [
  { no: "1", title: "เปิดกราฟ XAUUSD บน TradingView", desc: "เพิ่มอินดิเคเตอร์ TradePulse เข้ากับกราฟทองคำที่คุณใช้อยู่" },
  { no: "2", title: "อ่านโซนคะแนนสูงและสัญญาณ", desc: "ดูโซนที่ confluence score สูง ประกอบกับสัญญาณ Gold Core และ ICT SD" },
  { no: "3", title: "วางแผน TP/SL ก่อนเข้าเทรด", desc: "ระบบคำนวณ SL และ TP สองชั้นจาก ATR ให้ พร้อมติดตามแผนและอัปเดตให้เมื่อราคาเปลี่ยน" },
];

export interface TrustItem {
  label: string;
  icon: string;
}

export const trustItems: TrustItem[] = [
  { label: "ออกแบบสำหรับ XAUUSD", icon: "Target" },
  { label: "ใช้งานบน TradingView", icon: "LineChart" },
  { label: "แจ้งเตือนเข้า Telegram", icon: "BellRing" },
  { label: "มีคู่มือและทีมช่วยเหลือ", icon: "BookOpen" },
];

/** สิ่งที่ผู้ใช้จะได้รับ (แทนที่รีวิว เพราะยังไม่มีรีวิวจริง) */
export const benefits: string[] = [
  "อินดิเคเตอร์ 3 ตัวครบชุด ใช้งานบน TradingView",
  "โมดูลวิเคราะห์ 19 กลุ่ม ปรับได้ทุกค่ารวม 148 การตั้งค่า",
  "สัญญาณเตือน 15 แบบ ส่งเข้า Telegram ได้",
  "สัญญาณ Buy / Sell พร้อม Entry, TP1, TP2 และ SL",
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
  { q: "ใช้กับ Timeframe ไหน?", a: "ใช้ได้ทุกไทม์เฟรม ระบบปรับความเข้มของการจับโซนให้เองบน TF เล็ก (M1-M5) และมีตัวกรองช่วงเวลาเทรดตาม Session เวลาไทยให้ด้วย" },
  { q: "อินดิเคเตอร์ Repaint หรือไม่?", a: "สัญญาณเข้าเทรดออกแบบให้ไม่ Repaint เมื่อเกิดสัญญาณแล้วใช้อ้างอิงได้ โดยยึดข้อมูลแท่งที่ปิดแล้วเป็นหลัก" },
  { q: "ติดตั้งและเริ่มใช้งานอย่างไร?", a: "สมัครสมาชิก แล้วแจ้ง TradingView username จากนั้นทีมงานจะเพิ่มสิทธิ์สคริปต์ให้ เมื่อได้รับสิทธิ์ก็เพิ่มอินดิเคเตอร์เข้ากราฟได้ทันที" },
  { q: "ยกเลิกสมาชิกได้หรือไม่?", a: "ยกเลิกได้ตามเงื่อนไขของแต่ละแพ็กเกจ โดยจัดการได้ในหน้าบัญชีของคุณ" },
  { q: "มีการรับประกันกำไรหรือไม่?", a: "ไม่มีการรับประกันผลกำไร TradePulse เป็นเครื่องมือช่วยวิเคราะห์และวางแผนเท่านั้น การเทรดมีความเสี่ยงและขึ้นกับการตัดสินใจของผู้ใช้" },
  { q: "ได้อินดิเคเตอร์กี่ตัว?", a: "ได้ 3 ตัวครับ — SMC Unified Suite (เอนจินโซนและ confluence), Change SL/TP (ต่อยอดพร้อมระบบติดตามแผน) และ SMC Suit strategy สำหรับดูผลทดสอบย้อนหลังบน TradingView" },
  { q: "แจ้งเตือนเข้า Telegram ได้จริงไหม?", a: "ได้ครับ ระบบรองรับ webhook ของ Telegram โดยตรง ตั้ง chat_id ของคุณเองแล้วเลือกได้ว่าจะแจ้งเฉพาะเหตุการณ์ไหน เช่น เข้าโซน ICT, เกิดสัญญาณ BUY/SELL, เกิด liquidity sweep, เกิด BOS/CHoCH หรือราคากลับมา retest โซนเดิม และกรองเฉพาะโซนที่คะแนนถึงเกณฑ์ได้" },
  { q: "Confluence Score คำนวณจากอะไร?", a: "ให้คะแนน 0-100 จากหลายปัจจัยรวมกัน เช่น ชนิดโซน (OB/FVG/SD/RJB), โซนซ้อนทับกัน, OB กับ FVG stack กัน, เกิดหลัง liquidity sweep, ไทม์เฟรมใหญ่ไปทางเดียวกัน และอยู่ฝั่ง discount/premium ที่ถูกต้อง โดยปรับน้ำหนักแต่ละปัจจัยเองได้" },
  { q: "ติดต่อทีมช่วยเหลือได้ทางไหน?", a: "ติดต่อทีมงานผ่านช่องทางที่ระบุในหน้าเว็บ ทีมงานพร้อมช่วยเหลือเรื่องการติดตั้งและการใช้งานระบบ" },
];
