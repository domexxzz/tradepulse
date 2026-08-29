import { BadgeCheck, Info, TriangleAlert } from "lucide-react";
import { MONTHLY_REGULAR } from "@/config/plans";
import { PRICE_LOCK_GRACE_DAYS, type PriceLockStatus } from "@/lib/pricing";
import { formatTHB } from "@/lib/utils";

/**
 * บอกสมาชิกว่าตัวเองได้เงื่อนไขราคาล็อกแบบไหน
 *
 * มีสองกลุ่มที่เงื่อนไขต่างกันจริง ๆ (ดู PRICE_LOCK_RULE_EFFECTIVE ใน lib/pricing.ts)
 * ถ้าไม่บอก สมาชิกกลุ่มเดิมจะอ่านข้อความโปรบนหน้าแรกแล้วเข้าใจผิดว่าตัวเอง
 * จะเสียสิทธิ์ตอนขาดอายุ ทั้งที่จริงไม่เสีย
 *
 * ⚠️ ข้อความต้องมาจาก priceLockStatusFor() ตัวเดียวกับที่ใช้คิดราคาจริง
 * ห้ามคำนวณสถานะซ้ำที่นี่ ไม่งั้นหน้าเว็บกับยอดเก็บเงินจะพูดคนละเรื่องได้
 */
export function PriceLockNote({ lock }: { lock: PriceLockStatus }) {
  if (lock.kind === "none") return null;

  const price = formatTHB(lock.monthlyTHB);

  const view = {
    permanent: {
      Icon: BadgeCheck,
      tone: "border-brand/35 bg-brand/5",
      iconTone: "text-brand",
      title: `คุณได้ราคา Founding ${price}/เดือน แบบล็อกถาวร`,
      body: "ราคานี้เป็นของคุณตลอดไป ต่ออายุเมื่อไหร่ก็ได้ราคาเดิม แม้เคยขาดอายุไปแล้วก็ตาม",
    },
    active: {
      Icon: BadgeCheck,
      tone: "border-brand/35 bg-brand/5",
      iconTone: "text-brand",
      title: `คุณได้ราคา Founding ${price}/เดือน`,
      body: `ราคานี้อยู่กับคุณตราบที่ต่ออายุต่อเนื่อง — หากขาดอายุเกิน ${PRICE_LOCK_GRACE_DAYS} วันแล้วสมัครใหม่ จะเป็นราคาปกติ ${formatTHB(MONTHLY_REGULAR)}/เดือน`,
    },
    lost: {
      Icon: TriangleAlert,
      tone: "border-border-card bg-surface-2",
      iconTone: "text-muted",
      title: "สิทธิ์ราคา Founding สิ้นสุดแล้ว",
      body: `เพราะขาดอายุเกิน ${PRICE_LOCK_GRACE_DAYS} วัน ราคาที่ใช้ตอนนี้คือราคาปกติ ${formatTHB(MONTHLY_REGULAR)}/เดือน`,
    },
  }[lock.kind];

  const { Icon, tone, iconTone, title, body } = view ?? {
    Icon: Info,
    tone: "border-border-card bg-surface-2",
    iconTone: "text-muted",
    title: "",
    body: "",
  };

  return (
    <div className={`flex max-w-xl gap-3 rounded-2xl border p-4 ${tone}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}
