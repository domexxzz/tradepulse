import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { REFUND_DAYS } from "@/config/legal";

/**
 * ป้ายรับประกันคืนเงิน
 * ตัวเลขวันมาจาก REFUND_DAYS ที่เดียว เปลี่ยนแล้วเปลี่ยนตามทุกจุดรวมถึงหน้า /refund
 *
 * ⚠️ GuaranteeStrip ตอนนี้ไม่มีใครเรียกแล้ว — เจ้าของโปรเจกต์สั่งถอดออกจากหน้าราคา
 * เก็บโค้ดไว้เพราะนโยบายจริงยังไม่ได้ยกเลิก (/refund กับ /terms ยังเขียนสัญญา 7 วันอยู่)
 * ถ้าจะเอากลับ: import แล้ววาง <GuaranteeStrip /> ใต้ <PromoCard> ใน marketing/Pricing.tsx
 * ส่วน GuaranteeLine ยังใช้อยู่ที่หน้าเลือกแพ็กเกจในพอร์ทัลสมาชิก (account/subscription)
 */
export function GuaranteeStrip() {
  return (
    <div className="mx-auto mt-8 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl border border-brand/30 bg-brand/5 px-5 py-3.5 text-center">
      <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
      <span className="text-sm font-semibold">รับประกันคืนเงินภายใน {REFUND_DAYS} วัน</span>
      <span className="text-sm text-muted">
        ลองใช้จริงก่อน ถ้าไม่ตรงกับสไตล์การเทรดของคุณ แจ้งขอคืนเงินได้เต็มจำนวน
      </span>
      <Link href="/refund" className="text-sm font-medium text-brand hover:underline">
        เงื่อนไข
      </Link>
    </div>
  );
}

/** บรรทัดย่อสำหรับวางใต้ปุ่มสมัครในการ์ดแต่ละใบ */
export function GuaranteeLine({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-xs text-muted ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
      คืนเงินได้ใน {REFUND_DAYS} วัน
    </p>
  );
}
