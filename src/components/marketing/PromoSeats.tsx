import { Flame, CheckCircle2 } from "lucide-react";
import { formatTHB } from "@/lib/utils";
import { MONTHLY_PROMO, MONTHLY_REGULAR } from "@/config/plans";
import type { PromoState } from "@/lib/pricing";

/**
 * แถบโปรเปิดตัว — บอกจำนวนที่นั่งที่เหลือจริงจากยอดสมาชิกที่จ่ายเงินแล้ว
 * ไม่ใช่ตัวเลขปลอมที่ตั้งไว้ให้ดูเร่งรีบ ถ้าเต็มแล้วก็บอกตามตรงว่าเต็ม
 */
export function PromoSeats({ promo }: { promo: PromoState }) {
  const pct = Math.min(100, Math.round((promo.taken / promo.seats) * 100));

  // ขึ้นต้นด้วยราคาที่ใช้อยู่ ไม่ใช่ประกาศว่าโปรที่ผ่านมาเต็มไปแล้ว
  // การเปิดหัวข้อราคาด้วยข่าวว่า "คุณพลาดไปแล้ว" ลดแรงจูงใจ ไม่ได้เพิ่ม
  if (!promo.active) {
    return (
      <div className="mx-auto mt-8 flex w-fit max-w-full items-center gap-2.5 rounded-2xl border border-border bg-surface px-5 py-3 text-sm text-muted">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
        ราคาปัจจุบัน{" "}
        <b className="text-foreground">{formatTHB(MONTHLY_REGULAR)}/เดือน</b>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-xl rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 shrink-0 text-brand" />
          โปรเปิดตัว · {promo.seats} คนแรก {formatTHB(MONTHLY_PROMO)}/เดือน
        </span>
        <span className="text-sm text-muted">
          เหลืออีก <b className="tnum text-brand">{promo.remaining}</b> ที่
        </span>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={promo.taken}
        aria-valuemin={0}
        aria-valuemax={promo.seats}
        aria-label={`สมัครแล้ว ${promo.taken} จาก ${promo.seats} ที่นั่ง`}
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-3 text-xs text-muted">
        ครบ {promo.seats} คนแล้วราคาจะขึ้นเป็น {formatTHB(MONTHLY_REGULAR)}/เดือน —
        แต่ใครที่สมัครทันช่วงนี้ <b className="text-foreground">จ่าย {formatTHB(MONTHLY_PROMO)} เท่าเดิมทุกครั้งที่ต่ออายุ</b>
      </p>
    </div>
  );
}
