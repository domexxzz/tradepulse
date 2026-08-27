import { Button } from "@/components/ui/Button";
import { LoopingClip } from "@/components/guide/LoopingClip";
import { heroClip } from "@/config/guide";
import { plans, plansFor } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { trustItems } from "@/config/features";
import { Icon } from "@/components/common/Icon";
import { ShieldCheck } from "lucide-react";

/**
 * Hero — ให้กราฟจริงเป็นพระเอก
 *
 * ของเดิมเป็นสองคอลัมน์ ตัวหนังสือซ้าย ภาพขวา ภาพเลยเล็กจนดูไม่ออกว่าอินดิเคเตอร์ทำอะไร
 * ทั้งที่ "ภาพกราฟที่รันสคริปต์จริง" คือหลักฐานชิ้นเดียวที่ทำให้คนเชื่อ
 * จัดใหม่เป็นพาดหัวเต็มความกว้างแล้ววางกราฟใหญ่ใต้ประโยค — คนเห็นของก่อนอ่านคำโฆษณา
 */
/**
 * @param monthlyTHB ราคารายเดือนที่ใช้อยู่จริงตอนนี้ (มาจาก getPromoState)
 *
 * ⚠️ ต้องรับเข้ามา ห้ามอ่านจากตัวแปร plans ตรง ๆ
 * plans คือแคตตาล็อก "ราคาเต็ม" ซึ่งในโครงราคา Founding 300 ทุกแพ็กเกจ
 * เฉลี่ยเท่ากันหมดที่ 1,290/เดือน (จ่ายยาวขึ้นไม่ได้ถูกลง)
 * ถ้าใช้ค่านั้นตอนโปรยังเปิดอยู่ ปุ่มจะโฆษณา 1,290 ทั้งที่หน้าราคาโชว์ 899
 * ของเดิมเขียนแบบนั้นได้เพราะแพ็กยาวเคยมีราคาส่วนลดฝังอยู่ในแคตตาล็อก
 */
export function Hero({ monthlyTHB }: { monthlyTHB?: number }) {
  const shown = monthlyTHB === undefined ? plans : plansFor(monthlyTHB);
  const cheapest = Math.min(...shown.map((p) => p.perMonthTHB));

  return (
    <section id="top" className="relative pb-[var(--sp-md)] pt-[var(--sp-hero)]">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow rise rise-1">XAUUSD · Smart Money Concept</p>

          <h1 className="display rise rise-2 mt-5 text-[length:var(--display-lg)]">
            อ่านกราฟทองคำ
            <br />
            <span className="text-gradient-brand">ด้วยเทคนิคระดับโปร</span>
          </h1>

          <p className="lede rise rise-2 mx-auto mt-6 max-w-xl">
            เห็นโครงสร้างตลาด โซนสำคัญ และจุดเข้า–ออก อยู่บนกราฟเดียว
            ไม่ต้องสลับอินดิเคเตอร์ไปมาอีกต่อไป
          </p>

          <div className="rise rise-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="#pricing" size="lg">
              เริ่มใช้งาน · เริ่มต้น {formatTHB(cheapest)}/เดือน
            </Button>
            <Button href="#chart" variant="outline" size="lg">
              ดูกราฟจริง
            </Button>
          </div>
        </div>

        {/*
          คลิปกราฟจริง — พระเอกของหน้า

          ของเดิมเป็นภาพนิ่ง ซึ่งบอกได้แค่ว่า "หน้าจอหน้าตาแบบนี้" แต่ไม่ได้บอกว่า
          อินดิเคเตอร์ตัดสินใจยังไง คลิปนี้เป็นการเดิน Bar Replay ให้เห็นสัญญาณ
          กับโซนโผล่ขึ้นมาทีละแท่ง ซึ่งเป็นสิ่งที่คนอยากรู้จริง ๆ ก่อนตัดสินใจซื้อ
        */}
        <figure className="rise rise-4 relative mx-auto mt-14 max-w-5xl">
          {/* แสงเขียวจาง ๆ หลังคลิป ให้กราฟลอยขึ้นจากพื้นดำ */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -top-6 bottom-6 rounded-[2rem] bg-brand/10 blur-3xl"
          />
          <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface p-1.5 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)]">
            <LoopingClip
              src={heroClip.src}
              poster={heroClip.poster}
              label={heroClip.label}
              width={heroClip.width}
              height={heroClip.height}
              eager
            />
          </div>
          <figcaption className="mt-3.5 text-center text-xs text-faint">
            คลิปจากกราฟจริงที่รันอินดิเคเตอร์ บันทึกในโหมด Bar Replay ของ TradingView ·
            เป็นการเดินย้อนหลังเพื่อสาธิต ไม่ใช่การเทรดสด และไม่ใช่การรับประกันผลในอนาคต
          </figcaption>
        </figure>

        {/* จุดเด่นสั้น ๆ — ย้ายมาไว้ใต้ภาพ ไม่ให้แย่งความสนใจจากพาดหัว */}
        <ul className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {trustItems.map((t) => (
            <li key={t.label} className="flex items-center gap-2 text-sm text-muted">
              <Icon name={t.icon} className="h-4 w-4 text-brand" />
              {t.label}
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
          <ShieldCheck className="h-3.5 w-3.5" />
          เครื่องมือช่วยวิเคราะห์ ไม่ใช่สัญญาณการันตีกำไร — ผู้ใช้ตัดสินใจและบริหารความเสี่ยงเอง
        </p>
      </div>
    </section>
  );
}
