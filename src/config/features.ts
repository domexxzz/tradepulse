/** เนื้อหาเว็บทั้งหมด (แก้ที่นี่ที่เดียว) — อิงสเปกฟีเจอร์จริงของ QVX ไม่มีสถิติ/รีวิวปลอม */

/**
 * screenshot จริงของฟีเจอร์ พร้อมขนาดของไฟล์
 *
 * ที่ต้องเก็บ width/height ไว้ด้วย เพราะหน้า /features/[slug] เอาไปกำหนดสัดส่วนกรอบ
 * ให้ตรงกับไฟล์ ของเดิมยัดทุกรูปลงกรอบ 16:9 ตายตัวแล้ว object-cover ซึ่งทำสองอย่าง
 * พร้อมกัน — ครอปขอบทิ้ง แล้วซูมส่วนที่เหลือขึ้นเกินขนาดจริง ตัวหนังสือบนกราฟเลยเบลอ
 * ทั้งที่ไฟล์ยังคมอยู่ (รูปในโฟลเดอร์นี้สัดส่วนไม่เท่ากันเลย ตั้งแต่ 1.54:1 ถึง 2.12:1)
 */
export interface FeatureImage {
  /** path ใน public/ — ห้ามทับไฟล์ชื่อเดิมเมื่อเปลี่ยนรูป ดู README.txt ในโฟลเดอร์นั้น */
  src: string;
  /**
   * ขนาดจริงของไฟล์เป็นพิกเซล ต้องตรงเป๊ะ ใส่ผิดแล้วภาพจะถูกยืด
   * อ่านค่าจากไฟล์จริงด้วย `npm run images:sizes features` อย่ากรอกจากความจำ
   */
  width: number;
  height: number;
}

export interface Feature {
  title: string;
  /** ใช้เป็น URL หน้า /features/[slug] — เปลี่ยนแล้วลิงก์เดิมจะพัง ระวังด้วย */
  slug: string;
  /**
   * ชื่อย่อแบบที่อินดิเคเตอร์เขียนไว้บนกราฟ (FVG, OB, LQ...) ใช้ในแถบเลือกฟีเจอร์
   * บนจอเล็ก ที่ชื่อเต็มยาวเกินกว่าจะวางเรียงกันได้ — ตั้งใจให้ตรงกับป้ายบนชาร์ต
   * เพื่อให้แถบนั้นอ่านเหมือน legend ของอินดิเคเตอร์เอง
   */
  short: string;
  desc: string;
  howto: string;
  icon: string;
  /**
   * screenshot จริง — ไม่ใส่ = ซ่อนฟีเจอร์นั้นทั้งหมด (ดูตัวกรอง hasScreenshot ท้ายไฟล์)
   * วิธีทำรูปใหม่และกฎการตั้งชื่อ ดู public/images/features/README.txt
   */
  image?: FeatureImage;
}

export const coreIntro =
  "QVX รวมเครื่องมืออ่านโครงสร้างราคา โซนสำคัญ และสัญญาณสำหรับวางแผนเทรดไว้ในอินดิเคเตอร์เดียว เพื่อช่วยให้ผู้ใช้เห็นบริบทของตลาดก่อนตัดสินใจ";

const coreFeaturesAll: Feature[] = [
  {
    title: "FVG — Fair Value Gap",
    slug: "fvg",
    short: "FVG",
    icon: "SeparatorHorizontal",
    image: { src: "/images/features/fvg-v4.webp", width: 2280, height: 1074 },
    desc: "แสดงบริเวณที่ราคาเคลื่อนที่เร็วและทิ้งช่องว่างไว้ ใช้เฝ้าดูจังหวะที่ราคาอาจกลับมาทดสอบหรือเกิดปฏิกิริยา",
    howto: "รอให้ราคากลับเข้าใกล้โซน FVG แล้วดูโครงสร้างตลาดและสัญญาณยืนยันก่อนวางแผนเข้าเทรด",
  },
  {
    title: "OB — Order Block",
    slug: "order-block",
    short: "OB",
    icon: "Boxes",
    image: { src: "/images/features/order-block-v4.webp", width: 2280, height: 1402 },
    desc: "แสดงโซนที่เคยเกิดแรงซื้อหรือแรงขายชัดเจน ใช้เป็นบริเวณสำคัญสำหรับเฝ้าดูการตอบสนองของราคา",
    howto: "เมื่อราคากลับมาที่โซน OB ให้รอพฤติกรรมราคาหรือสัญญาณยืนยัน ไม่ควรเข้าออเดอร์ทันทีเพียงเพราะราคาชนโซน",
  },
  {
    title: "LQ — Liquidity & Sweep",
    slug: "liquidity-sweep",
    short: "LQ",
    icon: "Droplets",
    image: { src: "/images/features/liquidity-sweep-v4.webp", width: 2280, height: 1232 },
    desc: "ช่วยมองเห็นจุดสภาพคล่อง และจังหวะที่ราคากวาดระดับสำคัญก่อนกลับตัว",
    howto: "เมื่อเกิด Sweep ให้ใช้เป็นข้อมูลประกอบกับโซนใกล้เคียงและโครงสร้างตลาด เพื่อประเมินว่าราคาอาจมีแรงกลับหรือไม่",
  },
  {
    title: "DM-SP — Demand / Supply Zone",
    slug: "demand-supply-zone",
    short: "DM-SP",
    icon: "LayoutGrid",
    image: { src: "/images/features/demand-supply-zone-v4.webp", width: 2280, height: 1582 },
    desc: "แสดง Demand Zone และ Supply Zone ซึ่งเป็นบริเวณที่ราคาเคยมีแรงซื้อหรือแรงขายเด่นชัด",
    howto: "ใช้ Demand Zone เพื่อเฝ้าหาจังหวะฝั่ง Buy และใช้ Supply Zone เพื่อเฝ้าหาจังหวะฝั่ง Sell โดยรอสัญญาณยืนยันเมื่อราคากลับเข้าโซน",
  },
  {
    title: "BOS — Break of Structure",
    slug: "break-of-structure",
    short: "BOS",
    icon: "GitBranch",
    image: { src: "/images/features/break-of-structure-v4.webp", width: 2280, height: 1422 },
    desc: "แสดงเมื่อราคาทะลุโครงสร้างสำคัญ ช่วยให้เห็นว่าราคาอาจยังมีแรงเดินต่อในทิศทางเดิม",
    howto: "ใช้ BOS เพื่อยืนยันทิศทางตลาด แล้วรอราคาย่อกลับหาโซนสำคัญก่อนมองหาจังหวะเข้าเทรด",
  },
  {
    title: "CHoCH / MSS — Change of Character",
    slug: "change-of-character",
    short: "CHoCH",
    icon: "Shuffle",
    image: { src: "/images/features/change-of-character-v4.webp", width: 2280, height: 1476 },
    desc: "แสดงเมื่อโครงสร้างราคาเริ่มเปลี่ยนไปจากทิศทางเดิม เป็นสัญญาณเตือนว่าตลาดอาจกำลังเปลี่ยนแนวโน้ม",
    howto: "หลังเกิด CHoCH ให้รอราคากลับมาทดสอบโซนสำคัญและมีสัญญาณยืนยัน ก่อนพิจารณาแผนในทิศทางใหม่",
  },
  {
    title: "Buy / Sell Scalping",
    slug: "buy-sell-scalping",
    short: "Scalping",
    icon: "Zap",
    image: { src: "/images/features/buy-sell-scalping-v4.webp", width: 2280, height: 1324 },
    desc: "สัญญาณ Buy / Sell สำหรับช่วยหาจังหวะเทรดระยะสั้นบนกราฟทองคำ โดยแสดงเมื่อระบบพบเงื่อนไขที่เข้าเกณฑ์",
    howto: "รอให้สัญญาณปรากฏหลังแท่งเทียนปิด แล้วตรวจสอบว่าอยู่ใกล้โซนสำคัญและสอดคล้องกับโครงสร้างตลาดก่อนเข้าเทรด",
  },
  {
    title: "ICT Buy",
    slug: "ict-buy",
    short: "ICT Buy",
    icon: "TrendingUp",
    image: { src: "/images/features/ict-buy-v4.webp", width: 2280, height: 1434 },
    desc: "สัญญาณ Buy ที่ช่วยค้นหาจังหวะเมื่อราคาแสดงแรงตอบสนองเชิงบวกจากบริเวณ Demand หรือโซนสำคัญ",
    howto: "ใช้เมื่อราคากลับมาที่ Demand Zone หรือ Bullish OB แล้วเกิด ICT Buy โดยกำหนดจุดตัดขาดทุนและเป้าหมายตามแผนที่ระบบแสดง",
  },
  {
    title: "ICT Sell",
    slug: "ict-sell",
    short: "ICT Sell",
    icon: "TrendingDown",
    image: { src: "/images/features/ict-sell-v4.webp", width: 2280, height: 1238 },
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
    short: "Supertrend",
    icon: "Activity",
    image: { src: "/images/features/supertrend-snap-v4.webp", width: 1920, height: 1200 },
    desc: "แสดงเส้นแนวโน้มบนกราฟเพื่อช่วยให้มองภาพรวมของราคาและจังหวะการเปลี่ยนทิศทางได้ชัดขึ้น",
    howto: "ใช้ดูทิศทางประกอบกับโครงสร้างตลาดและโซนสำคัญ ไม่ควรใช้เส้นแนวโน้มเพียงอย่างเดียวในการตัดสินใจเข้าเทรด",
  },
  {
    title: "EMA200",
    slug: "ema200",
    short: "EMA200",
    icon: "LineChart",
    image: { src: "/images/features/ema200-snap-v4.webp", width: 1920, height: 1200 },
    desc: "แสดงเส้นแนวโน้มระยะยาวบนกราฟ เพื่อช่วยประเมินว่าราคาอยู่ในบริบทขาขึ้นหรือขาลง",
    howto: "ใช้เป็นภาพรวมประกอบสัญญาณ Scalping และโครงสร้างตลาด โดยให้ความสำคัญกับแผนที่สอดคล้องกับทิศทางใหญ่",
  },
  {
    title: "Higher Timeframe Alignment — HTF",
    slug: "htf-alignment",
    short: "HTF",
    icon: "Layers",
    desc: "ใช้แนวโน้มและโซนจาก Timeframe ใหญ่เป็นข้อมูลประกอบการวิเคราะห์บน Timeframe ที่ใช้เข้าเทรด",
    howto: "ดูทิศทางของ TF ใหญ่ก่อน แล้วใช้โซนและสัญญาณบน TF เล็กเพื่อหาแผนที่สอดคล้องกัน",
  },
  {
    title: "Confluence Score",
    slug: "confluence-score",
    short: "Confluence",
    icon: "Gauge",
    desc: "ระบบให้คะแนนโซน 0-100 เพื่อช่วยจัดลำดับว่าโซนใดมีองค์ประกอบสนับสนุนหลายด้านมากกว่า",
    howto: "ให้ความสำคัญกับโซนคะแนนสูงร่วมกับโครงสร้างตลาดและสัญญาณยืนยัน คะแนนเป็นเพียงเครื่องมือช่วยคัดกรอง ไม่ใช่การรับประกันผลลัพธ์",
  },
  {
    title: "Zone Lifecycle",
    slug: "zone-lifecycle",
    short: "Lifecycle",
    icon: "RefreshCw",
    desc: "ติดตามสถานะของโซนว่าเป็นโซนใหม่ ถูกแตะ ถูกใช้งาน หรือเสียโครงสร้างแล้ว เพื่อให้กราฟเหลือข้อมูลที่ยังน่าติดตาม",
    howto: "โฟกัสโซนที่ยังใหม่หรือเพิ่งถูกแตะ และระวังโซนที่ราคาทะลุหรือถูกใช้งานไปแล้ว",
  },
  {
    title: "PPDD Order Block",
    slug: "ppdd-order-block",
    short: "PPDD",
    icon: "Boxes",
    desc: "แสดง Order Block ที่เกิดหลังการกวาด Liquidity เพื่อช่วยเน้นบริเวณที่มีบริบทด้านสภาพคล่องร่วมด้วย",
    howto: "ใช้เป็นตัวช่วยคัด OB ที่น่าสนใจขึ้น แล้วรอให้ราคากลับมามีปฏิกิริยาและมีสัญญาณยืนยันก่อนวางแผน",
  },
  {
    title: "High Volume Bar — HVB",
    slug: "high-volume-bar",
    short: "HVB",
    icon: "BarChart3",
    desc: "เน้นแท่งเทียนที่มีปริมาณการซื้อขายเด่นกว่าปกติ เพื่อช่วยให้มองเห็นช่วงที่ตลาดมีแรงเข้ามาชัดเจน",
    howto: "ใช้สังเกตแรงของการเคลื่อนที่ โดยดูร่วมกับโซนและโครงสร้างตลาด ไม่ควรใช้ Volume Bar เพียงอย่างเดียวเพื่อเข้าเทรด",
  },
  {
    title: "Stacked OB + FVG",
    slug: "stacked-ob-fvg",
    short: "Stacked",
    icon: "Layers",
    desc: "แสดงบริเวณที่ Order Block และ Fair Value Gap เกิดร่วมกัน เพื่อช่วยให้เห็นโซนที่มีองค์ประกอบซ้อนกัน",
    howto: "ใช้เป็นจุดเฝ้าดูราคาเป็นพิเศษ แล้วรอสัญญาณยืนยันเมื่อราคากลับเข้ามาใกล้โซน",
  },
  {
    title: "Rejection Block — RJB",
    slug: "rejection-block",
    short: "RJB",
    icon: "Ban",
    image: { src: "/images/features/rejection-block-v4.webp", width: 1920, height: 1200 },
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
  {
    problem: "วิเคราะห์หลายองค์ประกอบ แต่ต้องแยกดูทีละส่วน",
    solution:
      "QVX รวมมุมมองไว้ด้วยกัน เห็นโครงสร้างราคา โซน และองค์ประกอบสำคัญของตลาดบนกราฟเดียว",
  },
  {
    problem: "เห็นสัญญาณ BUY / SELL แต่ยังต้องหาบริบทประกอบเอง",
    solution:
      "QVX แสดงบริบทควบคู่กับสัญญาณ ช่วยให้มองตำแหน่งของราคาและโครงสร้างตลาดประกอบกับจังหวะที่ระบบแสดง",
  },
  {
    problem: "ต้องใช้หลายเครื่องมือเพื่อประกอบแผนการเทรด",
    solution:
      "QVX รวมขั้นตอนการวิเคราะห์ไว้ใน Indicator เดียว ตั้งแต่การอ่านโครงสร้าง พื้นที่สำคัญ ไปจนถึง Scalping และ ICT Signals",
  },
];

export interface Step {
  no: string;
  title: string;
  desc: string;
  image: string;
  imageAlt: string;
}
/**
 * ขั้นตอนตั้งแต่สมัครจนเปิดกราฟใช้งานได้จริง
 *
 * ⚠️ เขียนตามที่ระบบทำงานจริง อย่าแต่งให้ดูง่ายกว่าความจริง
 * ขั้นที่ 3 มีอยู่เพราะสคริปต์บน TradingView เป็นแบบ invite-only
 * ทีมงานต้องรู้ username ถึงจะเพิ่มสิทธิ์ให้ถูกบัญชีได้ ข้ามไม่ได้
 * ขั้นที่ 4 ใช้คำว่า "หลังตรวจสอบ" ไม่ใช่ "ทันที" เพราะสลิปต้องผ่านการตรวจก่อน
 */
export const steps: Step[] = [
  {
    no: "1",
    title: "สมัครสมาชิก",
    desc: "สร้างบัญชีด้วยอีเมล ใช้เวลาไม่ถึงนาที",
    image: "/images/how-it-works/qvx-step-01-register.webp",
    imageAlt: "ภาพประกอบฟอร์มสมัครสมาชิกพร้อมเครื่องหมายยืนยัน",
  },
  {
    no: "2",
    title: "เลือกแพ็กเกจ",
    desc: "เลือกระยะเวลาที่ต้องการ ชำระผ่าน PromptPay แล้วแนบสลิป",
    image: "/images/how-it-works/qvx-step-02-package.webp",
    imageAlt: "ภาพประกอบการเลือกแพ็กเกจจากการ์ดสามตัวเลือก",
  },
  {
    no: "3",
    title: "แจ้ง TradingView Username",
    desc: "กรอกในหน้าบัญชี เพื่อให้ทีมงานเพิ่มสิทธิ์ให้ถูกบัญชี",
    image: "/images/how-it-works/qvx-step-03-tradingview-username.webp",
    imageAlt: "ภาพประกอบโปรไฟล์ผู้ใช้เชื่อมกับช่องกรอกและกุญแจ",
  },
  {
    no: "4",
    title: "รับสิทธิ์ใช้งาน",
    desc: "หลังตรวจสอบ เพิ่มอินดิเคเตอร์เข้ากราฟ พร้อมลิงก์เข้ากลุ่ม Telegram",
    image: "/images/how-it-works/qvx-step-04-access-granted.webp",
    imageAlt: "ภาพประกอบกราฟแท่งเทียนพร้อมแม่กุญแจปลดล็อก",
  },
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

/**
 * ข้อความบน "การ์ดสรุปสินค้า" — ใช้ร่วมกันระหว่างหน้าแรกกับหน้า /card
 *
 * พาดหัวแยกบรรทัดเองด้วย headlineLines ไม่ปล่อยให้เบราว์เซอร์ตัด
 * เพราะการ์ดเป็นงานจัดวางที่จุดตัดบรรทัดมีผลกับองค์ประกอบ
 * ถ้าปล่อยอิสระ จุดตัดจะขยับตามความกว้างจอ และภาษาไทยยังโดน ICU ตัดกลางคำอีก
 * (ดูหมายเหตุยาวที่ .display ใน globals.css)
 *
 * ⚠️ ราคาไม่ได้อยู่ในนี้ — ต้องมาจาก getPromoState เสมอ
 * ราคาบนการ์ดที่ไม่ตรงกับหน้าชำระเงินคือปัญหาที่แก้ทีหลังไม่ได้
 */
export const productCard = {
  brandLine: "QVX · Quant Vision X",
  /**
   * พาดหัวสามบรรทัด ตามภาพตัวอย่างที่ลูกค้าส่งมา
   * บรรทัดแรกเป็นสีขาว บรรทัดที่เหลือไล่เฉดเขียว
   *
   * แยกบรรทัดเองไม่ปล่อยให้เบราว์เซอร์ตัด เพราะจุดตัดมีผลกับองค์ประกอบ
   * และภาษาไทยยังโดน ICU ตัดกลางคำ (ดูหมายเหตุที่ .display ใน globals.css)
   */
  headlineLines: ["QVX INDICATOR", "วิเคราะห์ตลาด", "ในระบบเดียว"],
  subtitle:
    "QVX รวมการวิเคราะห์โครงสร้างราคา โซนสำคัญ และระบบสัญญาณไว้บน TradingView เพื่อช่วยให้เห็นบริบทและจังหวะสำคัญของตลาดในระบบเดียว",
  /** บรรทัดจุดเด่นคั่นด้วยจุด — สั้นพอให้กวาดตาผ่านได้ในครั้งเดียว */
  highlights: ["Buy / Sell Signal", "Entry · TP / SL", "โครงสร้างตลาด + โซน OB / FVG"],
} as const;
