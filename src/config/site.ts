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
