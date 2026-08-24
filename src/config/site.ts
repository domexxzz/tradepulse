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

  // ใช้ "/#..." เพื่อให้ลิงก์ใน Footer ใช้ได้จากทุกหน้า ไม่ใช่เฉพาะหน้าแรก
  nav: [
    { label: "ฟีเจอร์", href: "/#features" },
    { label: "กราฟ", href: "/#chart" },
    { label: "วิธีทำงาน", href: "/#how" },
    { label: "เดโม", href: "/#demo" },
    { label: "ผลลัพธ์", href: "/#results" },
    { label: "สัญญาณสด", href: "/#signals" },
    { label: "Telegram", href: "/#telegram" },
    { label: "ชุมชน", href: "/#community" },
    { label: "ราคา", href: "/#pricing" },
    { label: "คำถามพบบ่อย", href: "/#faq" },
  ],
} as const;

/** ระบบชำระเงินออนไลน์พร้อมใช้งานหรือยัง (เปิดเมื่อมี Stripe publishable key) */
export const paymentsEnabled = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/** มีช่องทางติดต่อจริงหรือยัง */
export const hasLineContact = Boolean(site.contact.lineUrl);

/**
 * กราฟ TradingView ที่เว็บนี้เชื่อมต่อ
 * - chartUrl: ลิงก์ layout จริงที่โหลดอินดิเคเตอร์ TradePulse ไว้แล้ว (เปิดในแท็บใหม่)
 *   หมายเหตุ: TradingView ตั้ง CSP `frame-ancestors 'none'` ทั้งเว็บ (ตรวจแล้วแม้หน้า public
 *   ที่ตอบ 200 ก็มี header นี้) จึง iframe หน้ากราฟไม่ได้ไม่ว่ากรณีใด
 *   บนเว็บเราจึงใช้ภาพ snapshot + Advanced Chart widget แล้วลิงก์ออกไปหน้ากราฟจริง
 *   ใช้โดเมน th. เพื่อให้ UI เป็นภาษาไทย และส่ง ?symbol= ให้เปิดมาที่ XAUUSD ทันที
 * - symbol/interval: ตั้งให้ตรงกับ layout ด้านบน เพื่อให้ผู้ใช้เห็นภาพเดียวกัน
 */
export const tradingView = {
  chartUrl:
    process.env.NEXT_PUBLIC_TRADINGVIEW_CHART_URL ||
    "https://th.tradingview.com/chart/AOJ68CcI/?symbol=FOREXCOM%3AXAUUSD",
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

export interface ChartExample {
  /** ป้ายบนแท็บ */
  label: string;
  /** ไทม์เฟรมที่แคปมา */
  tf: string;
  /** ลิงก์ไฟล์ภาพ (s3.tradingview.com/snapshots/<ตัวแรกพิมพ์เล็ก>/<id>.png) */
  url: string;
  /** อัตราส่วนภาพ "กว้าง / สูง" — กันภาพกระโดดตอนโหลด */
  aspect: string;
  /** หน้า snapshot บน TradingView (ให้เครดิตที่มา + กดดูเต็มได้) */
  pageUrl: string;
  /** อธิบายว่าภาพนี้โชว์อะไร */
  caption: string;
}

/**
 * ตัวอย่างผลลัพธ์จริงจากอินดิเคเตอร์ — ทุกภาพมาจากกราฟที่รันสคริปต์จริง
 * เพิ่มตัวอย่างใหม่: กดกล้อง 📷 บน TradingView -> คัดลอกลิงก์ภาพ -> เพิ่มรายการที่นี่
 * (มีมากกว่า 1 รายการเมื่อไหร่ หน้าเดโมจะขึ้นแท็บให้สลับดูเอง)
 */
export const chartExamples: ChartExample[] = [
  {
    label: "Trend + Plan",
    tf: "1D",
    url: "https://s3.tradingview.com/snapshots/e/EI34kpKu.png",
    aspect: "1814 / 436",
    pageUrl: "https://www.tradingview.com/x/EI34kpKu/",
    caption:
      "โซน FVG และ Order Block ที่ระบบตีให้ พร้อมสัญญาณ LONG / SELL, ระดับ NEXT SUPPLY / NEXT DEMAND และกล่องสถานะแผนเทรด",
  },
];

/** ลิงก์กลุ่ม Telegram community (ตั้งใน env — ว่าง = ปุ่มลิงก์ไป pricing แทน) */
export const telegramCommunityUrl = process.env.NEXT_PUBLIC_TELEGRAM_COMMUNITY_URL || "";

/**
 * ลิงก์เชิญเซิร์ฟเวอร์ Discord — ชุมชนเปิด ใครก็เข้าได้
 * ห้องเฉพาะสมาชิกในเซิร์ฟเวอร์ล็อกไว้ ปลดตามแพ็กเกจที่สมัคร (ทีมงานให้ role เอง)
 * ⚠️ ใช้ลิงก์เชิญแบบไม่หมดอายุเท่านั้น (Discord: Edit Invite Link -> Expire After = Never)
 * ลิงก์ปัจจุบันตรวจแล้ว expires_at = null และลงที่ช่อง "ห้องรับยศ"
 */
export const discordInviteUrl =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/kA8cRPMQwb";

/** มีลิงก์ Discord ให้แสดงหรือยัง */
export const hasDiscord = Boolean(discordInviteUrl);

/** โหมดชำระเงิน: "qr" (PromptPay + แนบสลิป) หรือ "stripe" */
export const paymentMode = (process.env.NEXT_PUBLIC_PAYMENT_MODE || "qr") as "qr" | "stripe";
