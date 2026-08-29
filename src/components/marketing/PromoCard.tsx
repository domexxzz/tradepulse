import { CheckCircle2, ChevronRight, Crown, Flame, Info } from "lucide-react";
import { formatTHB } from "@/lib/utils";
import { MONTHLY_PROMO, MONTHLY_REGULAR } from "@/config/plans";
import type { PromoState } from "@/lib/pricing";

/**
 * สิ่งที่ราคา Founding ให้จริง — ทุกข้อตรวจสอบได้จากโค้ด ไม่ใช่คำโฆษณา
 *   ข้อ 1 = lockPromoPriceIfEligible() ใน lib/pricing.ts ที่เขียน User.lockedMonthlyTHB
 *   ข้อ 2 = planIncludes ใน config/plans.ts
 *   ข้อ 3 = getPromoState() ที่สลับไป MONTHLY_REGULAR เมื่อที่นั่งหมด
 */
const PERKS: string[] = [
  `จ่ายครั้งแรกแล้วราคาถูกล็อกทันที ต่ออายุกี่รอบก็ ${formatTHB(MONTHLY_PROMO)} เท่าเดิม`,
  "ได้ฟีเจอร์ครบเท่าราคาเต็ม พร้อมอัปเดตใหม่ตลอดอายุสมาชิก",
  `ครบ 300 สิทธิ์เมื่อไหร่ ราคากลับเป็น ${formatTHB(MONTHLY_REGULAR)}/เดือน สำหรับคนที่สมัครหลังจากนั้น`,
];

interface Copy {
  badge: string;
  title: string;
  subtitle: string;
  perksTitle: string;
  detailsLabel: string;
  detailsHref: string;
}

/**
 * ข้อความสองชุด ต่างกันที่ "อยู่ตรงไหนของเส้นทางลูกค้า"
 *   hero    — ยังไม่รู้ราคา หน้าที่คือสะกิดให้เลื่อนลงไปดูตารางราคา
 *   pricing — เห็นตารางแล้ว หน้าที่คือเทียบราคาปกติกับราคาพิเศษให้ชัด
 */
const COPY: Record<"hero" | "pricing", Copy> = {
  hero: {
    badge: "EXCLUSIVE OFFER",
    title: "300 ท่านแรกเท่านั้น",
    subtitle: "ราคาโปรโมชั่น จำกัดสิทธิ์",
    perksTitle: "สิทธิ์ราคาพิเศษนี้",
    detailsLabel: "รายละเอียดโปรโมชั่นเพิ่มเติม",
    detailsHref: "#pricing",
  },
  pricing: {
    badge: "FOUNDING 300",
    title: "สิทธิ์ราคาเปิดตัวสำหรับ 300 สมาชิกแรก",
    subtitle: "",
    perksTitle: "สิทธิ์ Founding 300",
    detailsLabel: "ดูเงื่อนไขโปรโมชั่นทั้งหมด",
    detailsHref: "#faq",
  },
};

/**
 * บล็อกโปร Founding 300 — ใช้ทั้งบนหัวหน้าเว็บและในหน้าราคา
 *
 * ตัวเลขที่นั่งมาจากยอดสมาชิกที่จ่ายเงินจริง (getPromoState) ไม่ใช่ตัวเลขปลอม
 * ที่ตั้งไว้ให้ดูเร่งรีบ — เต็มแล้วก็บอกตามตรงว่าเต็ม
 *
 * ⚠️ แถบขีดแสดง "สิทธิ์ที่เหลือ" ไม่ใช่ "สิทธิ์ที่ใช้ไป"
 * เพราะป้ายข้างบนเขียนว่า "เหลือสิทธิ์เพียง N" ถ้าแถบวิ่งสวนกับป้าย คนอ่านจะงง
 * (aria-label กำกับไว้ให้ screen reader อ่านได้ตรงกับที่ตาเห็น)
 */
export function PromoCard({
  promo,
  variant = "pricing",
  className = "",
}: {
  promo: PromoState;
  variant?: "hero" | "pricing";
  className?: string;
}) {
  if (!promo.active) {
    return (
      <div
        className={`card-frame mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-muted ${className}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
        โปรเปิดตัว {promo.seats} ที่นั่งแรกเต็มแล้ว — ราคาปัจจุบัน{" "}
        <b className="text-foreground">{formatTHB(MONTHLY_REGULAR)}/เดือน</b>
      </div>
    );
  }

  const copy = COPY[variant];
  const BadgeIcon = variant === "hero" ? Flame : Crown;
  /**
   * สัดส่วนสิทธิ์ที่ยังเหลือ ใช้เป็นความยาวแถบ
   * พื้นขั้นต่ำ 2% เพื่อให้จุดแสงปลายแถบยังมีที่ยืนตอนสิทธิ์เกือบหมด ไม่ถูกตัดหาย
   */
  const pct = Math.max(2, Math.round((promo.remaining / promo.seats) * 100));

  return (
    <div className={`promo-offer card-frame mx-auto w-full max-w-xl rounded-3xl px-5 pb-6 pt-7 sm:px-7 ${className}`}>
      <p className="promo-offer__badge mx-auto flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-wide">
        <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
        {copy.badge}
      </p>

      <h3 className="display mt-3.5 text-center text-[length:var(--display-md)]">{copy.title}</h3>
      {copy.subtitle && (
        <p className="mt-1.5 text-center text-base font-semibold text-brand sm:text-lg">{copy.subtitle}</p>
      )}

      <div className="promo-offer__seats mt-5 rounded-2xl px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm text-muted">เหลือสิทธิ์เพียง</span>
          <span className="flex items-baseline gap-1.5">
            <b className="display tnum text-brand text-[length:var(--display-md)]">
              {promo.remaining}
            </b>
            <span className="tnum text-sm text-muted">/ {promo.seats} สิทธิ์</span>
          </span>
        </div>

        <div
          className="promo-offer__bar mt-2.5"
          role="progressbar"
          aria-valuenow={promo.remaining}
          aria-valuemin={0}
          aria-valuemax={promo.seats}
          aria-label={`เหลือสิทธิ์ราคาพิเศษ ${promo.remaining} จาก ${promo.seats} ที่นั่ง`}
        >
          {/* แถบเดียวเรียบ ๆ ไม่ใช่หลายขีด — จุดแสงนุ่มอยู่ปลายแถบเท่านั้น (::after ใน globals.css) */}
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="promo-offer__perks mt-4 rounded-2xl px-3.5 py-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Info className="h-3.5 w-3.5 shrink-0 text-brand" />
          {copy.perksTitle}
        </p>
        <ul className="mt-2 space-y-1.5">
          {PERKS.map((perk) => (
            <li key={perk} className="flex gap-2 text-[11px] leading-relaxed text-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
              {perk}
            </li>
          ))}
        </ul>
      </div>

      <a
        href={copy.detailsHref}
        className="mt-4 flex items-center justify-center gap-1 text-[13px] font-medium text-brand transition-colors hover:text-brand-strong"
      >
        {copy.detailsLabel}
        <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
