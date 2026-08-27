"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Plan } from "@/config/plans";
import { createQrOrder } from "@/lib/actions/payment";
import { CheckoutButton } from "./CheckoutButton";
import { formatTHB, cn } from "@/lib/utils";

/**
 * เลือกระยะเวลา แล้วโชว์ราคาใบเดียว
 *
 * ของเดิมเป็นการ์ด 4 ใบเรียงกัน ซึ่งต่างกัน "ตัวแปรเดียว" คือระยะเวลา
 * เนื้อหาที่เหลือ (ปุ่ม การรับประกัน สิ่งที่ได้รับ) เหมือนกันเป๊ะทั้ง 4 ใบ
 * = ใช้พื้นที่ราว 1,200px เพื่อบอกเรื่องเดียว และทำให้เกิดปัญหาสองอย่าง:
 *
 * 1. ตัวเลขไล่ลง 1,290 → 890 → 790 → 699 แต่ใบที่ไฮไลต์คือ ฿790 (ราย 6 เดือน)
 *    ส่วนใบที่ถูกที่สุดจริง ๆ กลับเป็นใบจาง ๆ ริมขวา สายตากวาดแล้วขัดกันเอง
 *    แก้โดยติดป้าย "คุ้มที่สุด" ให้ใบที่ perMonthTHB ต่ำสุด — คำนวณจากข้อมูลจริง
 *    ไม่ได้ฮาร์ดโค้ด ถ้าวันหลังราคาเปลี่ยนจนลำดับสลับ ป้ายก็ย้ายตามเอง
 *
 * 2. การ์ดรายเดือนไม่มีส่วนลด เลยต้องใส่ช่องว่างสูง 22px แทนป้าย "ประหยัด"
 *    เพื่อให้ปุ่มของทั้ง 4 ใบอยู่ระดับเดียวกัน กลายเป็นรูโหว่ที่มองเห็นได้
 *    พอเหลือใบเดียวปัญหานี้หายไปเอง เพราะไม่ต้องจัดระดับให้ตรงกับใครแล้ว
 *
 * ยังเทียบราคาได้ครบเหมือนเดิม เพราะปุ่มเลือกโชว์ราคาต่อเดือนของทุกแพ็กเกจอยู่แล้ว
 * ไม่ได้ซ่อนตัวเลือกไว้หลังดรอปดาวน์
 *
 * ใช้ role="group" + aria-pressed แบบเดียวกับปุ่มสลับมุมมองใน LiveChart
 * ไม่ใช้ ARIA tabs เพราะจะต้องทำ roving tabindex เพิ่มโดยไม่ได้อะไรขึ้นมา
 */
export function PlanSelector({
  plans,
  includes,
  paymentMode,
  paymentsEnabled,
}: {
  plans: Plan[];
  includes: string[];
  paymentMode: string;
  paymentsEnabled: boolean;
}) {
  const defaultPlan = plans.find((p) => p.highlight) ?? plans[0];
  const [activeId, setActiveId] = useState(defaultPlan?.id);
  const active = plans.find((p) => p.id === activeId) ?? defaultPlan;

  if (!active) return null;

  /**
   * ใบที่ถูกที่สุดต่อเดือน — คิดจากข้อมูล ไม่ใช่ตั้งไว้ตายตัว
   *
   * ต้องเช็คว่ามีใบที่ "ถูกกว่าจริง" ด้วย เพราะพอที่นั่ง Founding เต็ม
   * ทุกแพ็กเกจจะเฉลี่ยเท่ากันหมดที่ 1,290/เดือน ถ้าไม่กันไว้ ป้าย "คุ้มที่สุด"
   * จะไปโผล่พร้อมกันทั้ง 4 ใบ ซึ่งอ่านแล้วไม่ได้ความหมายอะไรเลย
   */
  const perMonthValues = plans.map((p) => p.perMonthTHB);
  const cheapestPerMonth = Math.min(...perMonthValues);
  const hasCheaperOption = cheapestPerMonth < Math.max(...perMonthValues);

  const ctaClass =
    "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong";

  return (
    <div className="mx-auto mt-9 max-w-4xl">
      {/* ---------- ปุ่มเลือกระยะเวลา ---------- */}
      <div
        role="group"
        aria-label="เลือกระยะเวลาของแพ็กเกจ"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {plans.map((p) => {
          const on = p.id === active.id;
          const best = hasCheaperOption && p.perMonthTHB === cheapestPerMonth;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              aria-pressed={on}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition-colors",
                on
                  ? "border-brand/50 bg-brand-wash"
                  : "border-border bg-surface hover:border-border-strong"
              )}
            >
              <span className="block text-xs text-muted">{p.name}</span>
              {/* ตัวเลขหลักคือยอดที่จ่ายจริงทั้งก้อน ไม่ใช่ค่าเฉลี่ยต่อเดือน
                  ค่าเฉลี่ยเป็นเลขที่คำนวณขึ้นมา ส่วนยอดนี้คือเงินที่โอนจริง */}
              <span
                className={cn(
                  "tnum mt-0.5 block font-display text-lg font-bold",
                  on && "text-brand"
                )}
              >
                {formatTHB(p.priceTHB)}
              </span>
              {p.months > 1 && (
                <span className="tnum mt-0.5 block text-[11px] text-faint">
                  เฉลี่ย {formatTHB(p.perMonthTHB)}/เดือน
                </span>
              )}
              {(best || p.badge) && (
                <span className="mt-1.5 inline-flex rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {best ? "คุ้มที่สุด" : p.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------- ใบที่เลือกอยู่ ---------- */}
      <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border border-brand/35 bg-border-strong shadow-[0_28px_80px_-50px_rgba(110,227,74,.45)] md:grid-cols-2">
        <div className="bg-surface-2 p-6 sm:p-7">
          <p className="text-sm text-muted">{active.name}</p>

          {/* ยอดจ่ายจริงเป็นพระเอก คู่กับราคาเต็มขีดฆ่าไว้ข้าง ๆ ให้เห็นส่วนต่างทันที
              ราคาเต็มโชว์เฉพาะตอนที่ยังได้ราคา Founding อยู่ — หมดโปรแล้ว
              listPriceTHB จะเท่ากับ priceTHB เอง เงื่อนไขนี้เลยปิดตัวเอง
              ไม่มีทางเกิดกรณีขีดฆ่าราคาที่เท่ากับราคาที่จ่ายจริง */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="display tnum text-[length:var(--display-md)]">
              {formatTHB(active.priceTHB)}
            </span>
            {active.listPriceTHB > active.priceTHB && (
              <s className="tnum text-lg text-faint">{formatTHB(active.listPriceTHB)}</s>
            )}
          </div>

          <p className="tnum mt-2 text-sm text-muted">
            {active.billingNote}
            {active.months > 1 && <> · เฉลี่ย {formatTHB(active.perMonthTHB)}/เดือน</>}
          </p>

          {active.savingsTHB > 0 && (
            <p className="pill-brand tnum mt-3.5 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium">
              ประหยัด {formatTHB(active.savingsTHB)} จากราคาเต็ม
            </p>
          )}

          <div className="mt-6">
            {paymentMode === "qr" ? (
              <form action={createQrOrder}>
                <input type="hidden" name="planCode" value={active.id} />
                <button className={ctaClass}>สมัคร · โอนผ่าน QR</button>
              </form>
            ) : paymentsEnabled ? (
              <CheckoutButton planCode={active.id} className={ctaClass}>
                สมัครสมาชิก
              </CheckoutButton>
            ) : (
              <a href="/register" className={ctaClass}>
                สมัครบัญชี
              </a>
            )}
          </div>
        </div>

        {/* สิ่งที่ได้รับ — เหมือนกันทุกแพ็กเกจ จึงวางไว้ข้างเดียว ไม่ต้องพิมพ์ซ้ำ 4 รอบ */}
        <div className="bg-surface p-6 sm:p-7">
          <p className="text-2xs font-semibold uppercase tracking-[.18em] text-faint">
            ได้รับเหมือนกันทุกแพ็กเกจ
          </p>
          <ul className="mt-4 space-y-2.5">
            {includes.map((x) => (
              <li key={x} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
