"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/utils";

/** ฟีเจอร์หนึ่งตัวเท่าที่แผงนี้ต้องใช้ — ไม่รับทั้ง Feature เพื่อไม่ให้ config ทั้งก้อนไหลเข้า client bundle */
export interface ExplorerItem {
  title: string;
  short: string;
  slug: string;
  desc: string;
  howto: string;
  icon: string;
  /** ผ่านตัวกรอง hasScreenshot มาแล้ว จึงเป็น string เสมอ */
  image: string;
}

export interface ExplorerGroup {
  label: string;
  items: ExplorerItem[];
}

/**
 * แผงสำรวจฟีเจอร์ — ผืนผ้าใบใหญ่หนึ่งภาพ + แถบเลือกด้านข้าง
 *
 * ทำไมไม่ใช่กริดการ์ด 12 ใบเหมือนเดิม:
 *
 * 1. ภาพต้นฉบับทุกไฟล์คือ 960x600 พอย่อลงช่องการ์ดกว้าง ~365px แล้ว
 *    ป้าย โซน และเส้นที่อินดิเคเตอร์วาด — ซึ่งคือ "ของ" ที่เราขาย — เล็กจนอ่านไม่ออก
 *    การ์ดทั้ง 12 ใบเลยหน้าตาเหมือนกันหมดคือกราฟเขียวแดงเข้ม ๆ
 *    แผงนี้แสดงภาพเดียวที่ความกว้างเต็ม 960px = ขนาดจริงของไฟล์ อ่านออกทุกป้าย
 *
 * 2. กินพื้นที่หน้าน้อยลงราว 3,000px และเปลี่ยนการเลื่อนผ่านเฉย ๆ เป็นการกดเล่น
 *
 * 3. ภาพทั้ง 12 รวมกันแค่ ~200KB จึงเรนเดอร์ซ้อนกันไว้ทั้งหมดแล้วสลับด้วย opacity
 *    ได้เลย — กดแล้วเปลี่ยนทันทีไม่มีจังหวะโหลด next/image ยัง lazy ให้อยู่ดี
 *    คือจะยิงโหลดตอนเลื่อนมาถึง section นี้ ไม่ใช่ตอนเปิดหน้า
 *
 * หมายเหตุเรื่องความคม: 960px คือความกว้างจริงของไฟล์ ถ้าอยากให้คมบนจอ retina
 * ต้องแคป snapshot ใหม่ที่ 1920x1200 แล้วใส่แทน (อย่าลืมเปลี่ยนชื่อไฟล์ด้วย
 * ไม่งั้นตัว optimizer ของ Next จะเสิร์ฟภาพเก่าค้าง — ดู README ในโฟลเดอร์ภาพ)
 */
export function ExplorerPanel({ groups }: { groups: ExplorerGroup[] }) {
  const flat = groups.flatMap((g) => g.items);
  const [activeSlug, setActiveSlug] = useState(flat[0]?.slug ?? "");
  const active = flat.find((f) => f.slug === activeSlug) ?? flat[0];

  if (!active) return null;

  const panelId = "feature-explorer-panel";

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
      {/* ---------- แถบเลือกบนจอเล็ก: ชื่อย่อแบบเดียวกับป้ายบนชาร์ต ---------- */}
      <div className="lg:hidden">
        {groups.map((g) => (
          <div key={g.label} className="mt-4 first:mt-0">
            <p className="text-2xs font-semibold uppercase tracking-[.18em] text-faint">{g.label}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {g.items.map((f) => (
                <button
                  key={f.slug}
                  type="button"
                  onClick={() => setActiveSlug(f.slug)}
                  aria-current={f.slug === active.slug ? "true" : undefined}
                  aria-controls={panelId}
                  className={cn(
                    "truncate rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors",
                    f.slug === active.slug
                      ? "border-brand/45 bg-brand-wash text-brand"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
                  )}
                >
                  {f.short}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- ผืนผ้าใบ + คำอธิบายของตัวที่เลือก ---------- */}
      <div className="lg:order-1">
        <div className="relative mx-auto w-full max-w-[960px] overflow-hidden rounded-2xl border border-border-strong bg-black shadow-[0_40px_110px_-70px_rgba(0,0,0,1)]">
          {/* ⚠️ ต้องเป็น 16/9 + object-contain ไม่ใช่ 16/10 + object-cover
              ภาพชุดใหม่อัตราส่วนไม่เท่ากันเลย ตั้งแต่ 1.54 ถึง 2.12
              ถ้า cover ในกรอบ 16/10 ภาพกว้างอย่าง FVG (2.12) จะโดนตัดข้าง
              ซึ่งข้างขวาคือที่ป้าย FVG- FVG+ อยู่พอดี = ตัดของที่เราจะขายทิ้ง
              contain บนพื้นดำแทน แถบว่างที่เกิดขึ้นเป็นดำบนดำ มองไม่เห็นอยู่แล้ว */}
          <div className="relative aspect-[16/9]">
            {flat.map((f) => (
              <Image
                key={f.slug}
                src={f.image}
                alt={`ตัวอย่างการใช้งาน ${f.title} บนกราฟ XAUUSD`}
                fill
                sizes="(max-width: 1024px) 100vw, 960px"
                aria-hidden={f.slug !== active.slug}
                className={cn(
                  "object-contain transition-opacity duration-300",
                  f.slug === active.slug ? "opacity-100" : "opacity-0"
                )}
              />
            ))}
          </div>

          {/* ป้ายชื่อย่อมุมบน — ผูกภาพเข้ากับปุ่มที่เพิ่งกด */}
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-brand backdrop-blur">
            {active.short}
          </span>
        </div>

        <div
          id={panelId}
          aria-live="polite"
          className="mx-auto mt-6 w-full max-w-[960px] md:min-h-[11.5rem]"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon name={active.icon} className="h-[18px] w-[18px]" />
            </span>
            <h3 className="font-display text-lg font-semibold leading-tight">{active.title}</h3>
          </div>

          <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-muted">{active.desc}</p>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl rounded-xl border border-border bg-surface/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">วิธีใช้</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">{active.howto}</p>
            </div>

            <Link
              href={`/features/${active.slug}`}
              className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              อ่านรายละเอียด
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- แถบเลือกบนจอใหญ่: อ่านเหมือน legend ของอินดิเคเตอร์ ---------- */}
      <div className="hidden lg:order-2 lg:block">
        {groups.map((g) => (
          <div key={g.label} className="mt-7 first:mt-0">
            <p className="px-3 text-2xs font-semibold uppercase tracking-[.18em] text-faint">
              {g.label}
            </p>
            <ul className="mt-2 space-y-0.5">
              {g.items.map((f) => {
                const on = f.slug === active.slug;
                return (
                  <li key={f.slug}>
                    <button
                      type="button"
                      onClick={() => setActiveSlug(f.slug)}
                      aria-current={on ? "true" : undefined}
                      aria-controls={panelId}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border-l-2 py-2.5 pl-2.5 pr-3 text-left transition-colors",
                        on
                          ? "border-l-brand bg-brand-wash text-foreground"
                          : "border-l-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                      )}
                    >
                      <Icon
                        name={f.icon}
                        className={cn("h-[18px] w-[18px] shrink-0", on ? "text-brand" : "text-faint")}
                      />
                      <span className="text-[13px] font-medium leading-snug">{f.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
