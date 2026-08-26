import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { tradingView, hasChartSnapshot } from "@/config/site";
import { plans } from "@/config/plans";
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
export function Hero() {
  const cheapest = Math.min(...plans.map((p) => p.perMonthTHB));

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

        {/* ภาพกราฟจริง — พระเอกของหน้า */}
        {hasChartSnapshot && (
          <figure className="rise rise-4 relative mx-auto mt-14 max-w-5xl">
            {/* แสงเขียวจาง ๆ หลังภาพ ให้กราฟลอยขึ้นจากพื้นดำ */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-6 bottom-6 rounded-[2rem] bg-brand/10 blur-3xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface p-1.5 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)]">
              <div
                className="relative w-full overflow-hidden rounded-xl"
                style={{ aspectRatio: tradingView.snapshotAspect }}
              >
                <Image
                  src={tradingView.snapshotUrl}
                  alt="กราฟ XAUUSD ที่ติดตั้งอินดิเคเตอร์ TradePulse แสดงสัญญาณ BUY/SELL, ICT, CHoCH, โซน FVG และ Order Block"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-cover"
                />
              </div>
            </div>
            <figcaption className="mt-3.5 text-center text-xs text-faint">
              ภาพจากกราฟจริงที่รันอินดิเคเตอร์ · ตัวเลขบนภาพเป็นผลทดสอบย้อนหลัง ไม่ใช่การรับประกันผลในอนาคต
            </figcaption>
          </figure>
        )}

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
