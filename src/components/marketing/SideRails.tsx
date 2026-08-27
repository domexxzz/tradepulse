"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Flame, X } from "lucide-react";
import { formatTHB } from "@/lib/utils";
import { MONTHLY_REGULAR } from "@/config/plans";
import type { PromoState } from "@/lib/pricing";

/**
 * แถบโฆษณาลอยข้างจอ ซ้าย-ขวา
 *
 * ข้อจำกัดเรื่องพื้นที่ — คอนเทนต์กว้าง 1180px จอ 1366px จึงเหลือข้างละ 93px
 * ซึ่งไม่พอวางอะไรที่อ่านรู้เรื่อง แถบนี้เลยโผล่เฉพาะจอกว้างพอเท่านั้น
 * ต่ำกว่านั้นซ่อนทิ้ง ดีกว่าบีบจนอ่านไม่ออกหรือเลื่อนไปทับเนื้อหา
 * บนมือถือมี MobileStickyCTA ทำหน้าที่นี้อยู่แล้ว
 *
 * ความกว้างหดเองตามที่ว่างจริง ไม่ใช่ค่าคงที่ — ตอนแรกตั้งไว้ 164px ตายตัว
 * แล้ววัดในเบราว์เซอร์เจอว่าที่ 1536px มันล้นออกนอกจอ 7px เพราะ media query
 * นับความกว้างรวมแถบเลื่อน แต่พื้นที่วางจริง (clientWidth) น้อยกว่านั้น ~15px
 * min() ตรงนี้เลยตัดปัญหาทิ้งทั้งหมด ไม่ต้องเดา breakpoint ให้พอดี
 *
 * ตำแหน่งผูกกับขอบคอนเทนต์ ไม่ใช่ขอบจอ เพราะถ้าดันไปติดขอบจอ 1920px
 * มันจะลอยห่างจนไม่เกี่ยวกับสิ่งที่ผู้ใช้กำลังอ่านอยู่
 *
 * ตัวเลขที่นั่งดึงจาก PromoState ชุดเดียวกับ PromoSeats ในหน้าราคา
 * เพื่อไม่ให้สองที่บอกเลขไม่ตรงกัน และถ้าโปรเต็มแล้วแถบซ้ายจะไม่ขึ้นเลย
 */

/** ครึ่งความกว้าง container (1180/2 = 590) + ระยะห่างจากเนื้อหา 16px */
const RAIL_OFFSET = "calc(50% + 606px)";
const STORAGE_PREFIX = "qvx-rail-dismissed:";

/**
 * สถานะ "ปิดไปแล้ว" เก็บใน localStorage ซึ่งเป็น external store ของ React
 *
 * อ่านผ่าน useSyncExternalStore ไม่ใช่ setState ใน useEffect เพราะฝั่ง server
 * ไม่มี localStorage ให้อ่าน การ setState ตอน mount จะทำให้เรนเดอร์ซ้ำโดยไม่จำเป็น
 * (และ react-hooks/set-state-in-effect ก็ห้ามไว้)
 *
 * memory เป็นตัวสำรองสำหรับเบราว์เซอร์โหมดส่วนตัวที่เขียน localStorage ไม่ได้ —
 * กดปิดแล้วต้องปิดจริงในรอบนั้น แค่จำข้ามรอบไม่ได้เท่านั้น
 */
const dismissStore = {
  memory: new Set<string>(),
  listeners: new Set<() => void>(),

  subscribe(onChange: () => void) {
    dismissStore.listeners.add(onChange);
    return () => {
      dismissStore.listeners.delete(onChange);
    };
  },

  isDismissed(id: string) {
    if (dismissStore.memory.has(id)) return true;
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
    } catch {
      return false;
    }
  },

  dismiss(id: string) {
    dismissStore.memory.add(id);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
    } catch {
      // เขียนไม่ได้ก็ยังปิดได้จาก memory ด้านบน
    }
    dismissStore.listeners.forEach((onChange) => onChange());
  },
};

/** ฝั่ง server ยังไม่รู้ว่าเคยปิดหรือยัง ให้ถือว่ายังไม่ปิดเสมอ */
const notDismissed = () => false;

function useDismissed(id: string) {
  return useSyncExternalStore(
    dismissStore.subscribe,
    () => dismissStore.isDismissed(id),
    notDismissed
  );
}

export function SideRails({ promo }: { promo: PromoState }) {
  const [pastHero, setPastHero] = useState(false);
  const promoDismissed = useDismissed("promo");
  const guideDismissed = useDismissed("guide");

  // โผล่เมื่อ Hero เลื่อนพ้นจอไปแล้ว ใช้ observer แทน scroll listener
  // เพื่อไม่ให้มี handler วิ่งทุกเฟรมตอนผู้ใช้เลื่อนหน้า
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {promo.active && !promoDismissed && (
        <Rail
          side="left"
          show={pastHero}
          onClose={() => dismissStore.dismiss("promo")}
          label="โปรโมชันเปิดตัว"
        >
          <RailEyebrow icon={<Flame className="h-3 w-3" />}>โปรเปิดตัว</RailEyebrow>

          <p className="mt-3 font-display text-[2.5rem] font-bold leading-none text-brand tnum">
            {promo.remaining}
          </p>
          {/* เขียนตามจริง ไม่ใส่คำเร่งเร้าอย่าง "ที่นั่งสุดท้าย" — เหลือ 299 จาก 300
              ก็ยังไม่ใช่ของใกล้หมด ถ้อยคำตรงนี้ต้องเข้าชุดกับ PromoSeats ในหน้าราคา */}
          <p className="mt-1 text-xs leading-relaxed text-muted">
            ที่นั่งราคาโปรที่เหลือ จาก {promo.seats} คนแรก
          </p>

          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[11px] text-faint line-through">
              {formatTHB(MONTHLY_REGULAR)}/เดือน
            </p>
            <p className="font-display text-xl font-bold leading-tight">
              {formatTHB(promo.monthlyTHB)}
              <span className="text-xs font-normal text-muted">/เดือน</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              สมัครทันช่วงนี้ จ่ายเท่านี้ทุกครั้งที่ต่ออายุ
            </p>
          </div>

          <RailCta href="/#pricing">ดูแพ็กเกจ</RailCta>
        </Rail>
      )}

      {!guideDismissed && (
        <Rail
          side="right"
          show={pastHero}
          onClose={() => dismissStore.dismiss("guide")}
          label="คู่มือตั้งค่า"
        >
          <RailEyebrow icon={<BookOpen className="h-3 w-3" />}>ของใหม่</RailEyebrow>

          <p className="mt-3 font-display text-base font-bold leading-snug">
            คู่มือตั้งค่า
            <br />
            ครบ 3 ชุด
          </p>

          <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>· ค่าตั้งจริงทุกช่อง</li>
            <li>· ภาพหน้าชาร์ตจริง</li>
            <li>· คลิปสาธิตการทำงาน</li>
          </ul>

          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            SMC · Gold Booster · ICT SD
          </p>

          <RailCta href="/guide">เปิดคู่มือ</RailCta>
        </Rail>
      )}
    </>
  );
}

function RailEyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-brand">
      {icon}
      {children}
    </p>
  );
}

function Rail({
  side,
  show,
  onClose,
  label,
  children,
}: {
  side: "left" | "right";
  show: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const isLeft = side === "left";

  return (
    <aside
      aria-label={label}
      aria-hidden={!show}
      style={{
        ...(isLeft ? { right: RAIL_OFFSET } : { left: RAIL_OFFSET }),
        // 620 = ระยะขอบใน 606 + กันชน 14px เผื่อความกว้างแถบเลื่อน
        width: "min(164px, calc(50vw - 620px))",
      }}
      className={[
        "fixed top-1/2 z-30 hidden 2xl:block",
        "rounded-2xl border border-border-strong bg-surface/95 p-4 backdrop-blur-md",
        "shadow-[0_24px_60px_-30px_rgba(0,0,0,1)]",
        // เข้า-ออกด้วย opacity กับ transform เท่านั้น ไม่แตะคุณสมบัติที่ทำให้เกิด layout
        "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        "-translate-y-1/2",
        show
          ? "translate-x-0 opacity-100"
          : `pointer-events-none opacity-0 ${isLeft ? "-translate-x-4" : "translate-x-4"}`,
      ].join(" ")}
    >
      {/* เรืองแสงจาง ๆ ให้แถบลอยขึ้นจากพื้นหลัง ไม่ใช่กล่องสี่เหลี่ยมแปะเฉย ๆ */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-brand/10 blur-xl"
      />

      <button
        type="button"
        onClick={onClose}
        aria-label={`ปิดแถบ${label}`}
        tabIndex={show ? 0 : -1}
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-faint
                   transition-colors hover:bg-surface-2 hover:text-foreground
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-brand"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {children}
    </aside>
  );
}

function RailCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-4 inline-flex h-9 w-full items-center justify-center gap-1 rounded-full
                 bg-brand text-[13px] font-semibold text-brand-ink transition-colors
                 hover:bg-brand-strong focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
