/**
 * ศูนย์รวมข้อมูลแบรนด์ + ช่องทางติดต่อจริง
 * ⚠️ ช่องทางติดต่อเว้นว่างไว้ (แสดงเฉพาะเมื่อกรอกค่าจริง) — ห้ามใส่ค่าปลอมบน production
 */
export const site = {
  name: "TradePulse",
  fullName: "TradePulse",
  tagline: "อินดิเคเตอร์วิเคราะห์ทองคำ XAUUSD บน TradingView",
  description:
    "TradePulse รวม Trend, Buy/Sell Signal, Entry, TP/SL และ Risk Management ไว้ในระบบเดียว ช่วยให้เทรดเดอร์ทองคำวางแผนก่อนเข้าเทรดอย่างมีระบบ",

  // ตั้งค่าจริงผ่าน env / แก้ตรงนี้เมื่อพร้อม launch
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  contact: {
    lineUrl: process.env.NEXT_PUBLIC_LINE_OA_URL || "",
    lineId: process.env.NEXT_PUBLIC_LINE_OA_ID || "",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  },

  nav: [
    { label: "ฟีเจอร์", href: "#features" },
    { label: "กราฟ", href: "#chart" },
    { label: "วิธีทำงาน", href: "#how" },
    { label: "เดโม", href: "#demo" },
    { label: "ราคา", href: "#pricing" },
    { label: "คำถามพบบ่อย", href: "#faq" },
  ],
} as const;

/** ระบบชำระเงินออนไลน์พร้อมใช้งานหรือยัง (เปิดเมื่อมี Stripe publishable key) */
export const paymentsEnabled = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/** มีช่องทางติดต่อจริงหรือยัง */
export const hasLineContact = Boolean(site.contact.lineUrl);

/**
 * กราฟ TradingView ที่เว็บนี้เชื่อมต่อ
 * - chartUrl: ลิงก์ layout จริงที่โหลดอินดิเคเตอร์ TradePulse ไว้แล้ว (เปิดในแท็บใหม่)
 *   หมายเหตุ: TradingView ตั้ง CSP `frame-ancestors 'none'` บนหน้า /chart/ จึง iframe ไม่ได้
 *   บนเว็บเราจึงฝัง Advanced Chart widget แทน แล้วลิงก์ออกไปหน้ากราฟจริง
 * - symbol/interval: ตั้งให้ตรงกับ layout ด้านบน เพื่อให้ผู้ใช้เห็นภาพเดียวกัน
 */
export const tradingView = {
  chartUrl:
    process.env.NEXT_PUBLIC_TRADINGVIEW_CHART_URL ||
    "https://th.tradingview.com/chart/AOJ68CcI/",
  symbol: process.env.NEXT_PUBLIC_TRADINGVIEW_SYMBOL || "FOREXCOM:XAUUSD",
  interval: process.env.NEXT_PUBLIC_TRADINGVIEW_INTERVAL || "30",
  /**
   * ภาพ snapshot ของกราฟจริง (กดปุ่มกล้อง 📷 บน TradingView -> "คัดลอกลิงก์ภาพ")
   * เป็นวิธีเดียวที่แสดงเส้นอินดิเคเตอร์ TradePulse บนเว็บได้ เพราะ layout เป็น private
   * ตัวอย่าง: https://s3.tradingview.com/snapshots/x/XXXXXXXX.png
   */
  snapshotUrl:
    process.env.NEXT_PUBLIC_TRADINGVIEW_SNAPSHOT_URL ||
    "https://s3.tradingview.com/snapshots/e/EI34kpKu.png",
  /** อัตราส่วนภาพ snapshot — กันภาพกระโดด (CLS) ตอนโหลด ต้องแก้ตามภาพใหม่ที่เปลี่ยน */
  snapshotAspect: process.env.NEXT_PUBLIC_TRADINGVIEW_SNAPSHOT_ASPECT || "1814 / 436",
  /** หน้า snapshot บน TradingView (ให้เครดิตที่มาของภาพ) */
  snapshotPageUrl:
    process.env.NEXT_PUBLIC_TRADINGVIEW_SNAPSHOT_PAGE_URL ||
    "https://www.tradingview.com/x/EI34kpKu/",
} as const;

/** มีภาพ snapshot กราฟจริงให้แสดงหรือยัง */
export const hasChartSnapshot = Boolean(tradingView.snapshotUrl);
