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
  { id: "comp", label: "แถมให้ (ไม่คิดเงิน)" },
] as const;

export type SaleChannel = (typeof SALE_CHANNELS)[number]["id"];

export const channelLabel = (id: string) =>
  SALE_CHANNELS.find((c) => c.id === id)?.label ?? id;

/** ช่องทางที่ถือเป็นรายได้จริง (แถมให้ไม่นับ) */
export const isRevenueChannel = (id: string) => id !== "comp";
