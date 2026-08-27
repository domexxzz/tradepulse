import Link from "next/link";
import { BellRing, Clock3, CreditCard, Headphones, RefreshCcw, ShieldCheck } from "lucide-react";

const trustPoints = [
  { label: "PromptPay QR", detail: "ชำระตามยอด ไม่มีตัดบัตรอัตโนมัติ", Icon: CreditCard },
  { label: "เริ่มนับหลังอนุมัติ", detail: "ไม่เสียวันใช้งานระหว่างรอเปิดสิทธิ์", Icon: Clock3 },
  { label: "Telegram สมาชิก", detail: "รับลิงก์เชิญส่วนตัวในหน้าบัญชี", Icon: BellRing },
  { label: "ดูแลการติดตั้ง", detail: "มีคู่มือและช่องทางสอบถามทีมงาน", Icon: Headphones },
  { label: "ไม่มีต่ออายุเงียบ ๆ", detail: "แพ็กเกจ QR ไม่ตัดเงินรอบถัดไปเอง", Icon: RefreshCcw },
  { label: "เงื่อนไขชัดเจน", detail: "อ่านข้อกำหนดและนโยบายคืนเงินก่อนจ่าย", Icon: ShieldCheck },
] as const;

export function TrustCenter() {
  return (
    <aside aria-label="ข้อมูลสำคัญก่อนเลือกแพ็กเกจ" className="mx-auto mt-9 max-w-5xl rounded-3xl border border-border-strong bg-surface/80 p-5 sm:p-7">
      <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">ก่อนชำระเงิน</p><h3 className="display mt-2 text-xl sm:text-2xl">รู้ครบว่าจะจ่ายอย่างไร และได้รับอะไรต่อ</h3></div>
        <div className="flex gap-4 text-xs"><Link href="/terms" className="text-brand hover:underline">ข้อกำหนด</Link><Link href="/refund" className="text-brand hover:underline">นโยบายคืนเงิน</Link></div>
      </div>
      <ul className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {trustPoints.map(({ label, detail, Icon }) => (
          <li key={label} className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div></li>
        ))}
      </ul>
    </aside>
  );
}
