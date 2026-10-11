/**
 * คู่มือ PDF ให้ลูกค้าดาวน์โหลดเก็บไว้ — ไฟล์อยู่ที่ public/downloads/
 *
 * ต้นฉบับจากทีม (Canva / Word) — เล่มเปิดบัญชีต้นฉบับ 19.7 MB ย่อรูปเหลือ 150 dpi แล้ว
 * เพราะลูกค้าส่วนใหญ่โหลดบนมือถือ เปลี่ยนไฟล์เมื่อไหร่ให้เปลี่ยนชื่อไฟล์ด้วย
 * (เบราว์เซอร์/CDN จำไฟล์ชื่อเดิมไว้ ลูกค้าจะได้เล่มเก่า)
 */
export interface ManualPdf {
  id: "user-guide" | "open-account";
  title: string;
  desc: string;
  href: string;
  /** ชื่อไฟล์ตอนบันทึกลงเครื่องลูกค้า */
  fileName: string;
  pages: number;
  sizeLabel: string;
}

export const MANUAL_PDFS: ManualPdf[] = [
  {
    id: "user-guide",
    title: "คู่มือการใช้งาน QVX",
    desc: "พื้นฐาน SMC / ICT · อ่านโซนและสัญญาณ · ตั้งค่าอินดิเคเตอร์ · รับสัญญาณผ่าน Telegram",
    href: "/downloads/qvx-user-guide.pdf",
    fileName: "คู่มือการใช้งาน QVX.pdf",
    pages: 25,
    sizeLabel: "0.9 MB",
  },
  {
    id: "open-account",
    title: "คู่มือเปิดบัญชี ฝาก–ถอนเงิน (Wisdom)",
    desc: "สมัคร · ยืนยันตัวตน KYC · เปิดบัญชี MT5 · ฝากผ่าน 24Pay · ถอนเงิน",
    href: "/downloads/qvx-open-account-guide.pdf",
    fileName: "คู่มือเปิดบัญชี QVX.pdf",
    pages: 15,
    sizeLabel: "4.7 MB",
  },
];

export const manualPdf = (id: ManualPdf["id"]) => MANUAL_PDFS.find((m) => m.id === id)!;
