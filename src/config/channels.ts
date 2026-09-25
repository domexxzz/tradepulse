/**
 * ช่องทางการขาย — ลูกค้าไม่ได้ซื้อผ่านเว็บอย่างเดียว
 *
 * ส่วนใหญ่ทักมาทาง LINE / เพจ แล้วโอนตรง แอดมินจึงต้องบันทึกเองได้ว่า
 * เงินก้อนนี้มาจากช่องทางไหน ไม่งั้นรายได้รวมในแดชบอร์ดจะต่ำกว่าความจริง
 * และตอบไม่ได้ว่าช่องทางไหนขายดี
 */
export const SALE_CHANNELS = [
  { id: "web", label: "เว็บไซต์ (PromptPay QR)" },
  { id: "line", label: "LINE OA" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "transfer", label: "โอนตรง / นัดเจอ" },
  { id: "wisdom", label: "โบรก Wisdom (เปิดพอร์ต)" },
  { id: "comp", label: "แถมให้ (ไม่คิดเงิน)" },
] as const;

export type SaleChannel = (typeof SALE_CHANNELS)[number]["id"];

export const channelLabel = (id: string) =>
  SALE_CHANNELS.find((c) => c.id === id)?.label ?? id;

/**
 * ช่องทางที่ลูกค้าจ่ายเงินให้เราตรง ๆ
 *
 * ที่ไม่นับเป็นรายได้มีสองแบบ และเป็นคนละเหตุผลกัน
 *   comp   — แถมให้ ไม่มีเงินเข้าเลย
 *   wisdom — ลูกค้าเปิดพอร์ตกับโบรก เราได้ส่วนแบ่งจากโบรกทางอ้อม
 *            ไม่ใช่เงินที่ลูกค้าจ่ายเรา จึงไม่ควรโผล่ในยอดขายของเว็บ
 *
 * ผลพลอยได้ที่ตั้งใจ: adminActivateMembership บังคับยอดเป็น 0 ให้ช่องทางกลุ่มนี้
 * จึงไม่สร้างแถว Payment แปลว่าไม่กินที่นั่งโปร 300 คนแรกด้วย — ถูกต้องแล้ว
 * เพราะที่นั่งโปรมีไว้ให้คนที่จ่ายเงินจริง
 */
const NON_REVENUE_CHANNELS: readonly string[] = ["comp", "wisdom"];

export const isRevenueChannel = (id: string) => !NON_REVENUE_CHANNELS.includes(id);
