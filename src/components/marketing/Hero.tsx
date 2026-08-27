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
 *
 * ⚠️ ห้ามเพิ่มบล็อกใหม่คั่นระหว่างพาดหัวกับคลิป โดยไม่วัด fold ก่อน
 *
 * วัดของเดิมที่จอ 1805x915: ขอบบนคลิปอยู่ที่ y=601 สูง 342 → ขอบล่าง 943
 * ซึ่งเลยขอบจอไปแล้ว แปลว่า "พระเอกของหน้า" โดนตัดตั้งแต่ยังไม่ทันเลื่อน
 * และบนโน้ตบุ๊กจอ 768px เห็นคลิปแค่ ~167px จาก 342px
 *
 * สาเหตุคือมีของซ้อนอยู่เหนือคลิปเยอะเกิน — eyebrow, พาดหัว 2 บรรทัดขนาด 4.4rem,
 * คำโปรย, ปุ่ม, แล้วยังมีแถบชิป 4 อันที่พูดเรื่องเดียวกับ trustItems ใต้ภาพอีก
 * จึงตัดชิปที่ซ้ำทิ้ง ลดระยะบน และย้าย trustItems เข้าไปติดขอบล่างของกรอบกราฟ
 * ได้พื้นที่คืนราว 190px และแถบนั้นกลายเป็นส่วนหนึ่งของกรอบ แทนที่จะเป็นแถวลอย ๆ
 *
 * ไม่กลับไปทำสองคอลัมน์อีก เพราะคลิปอัดมาที่อัตราส่วน 2.94:1 ถ้าบีบลงคอลัมน์ขวา
 * ~768px จะเหลือสูงแค่ ~261px ซึ่งเตี้ยกว่าตอนวางเต็มความกว้าง (342px) เสียอีก
 */
/**
 * @param monthlyTHB ราคารายเดือนที่ใช้อยู่จริงตอนนี้ (จาก getPromoState)
 *   ต้องรับเข้ามา ไม่ใช่อ่านจาก `plans` ตรง ๆ เพราะ `plans` คือแคตตาล็อก
 *   "ราคาเต็ม" ซึ่งทุกแพ็กเกจเฉลี่ย 1,290 เท่ากันหมด ถ้าใช้ค่านั้นตอนโปร
 *   Founding ยังเปิดอยู่ ปุ่มจะโฆษณา 1,290 ทั้งที่เข้าจริงเริ่มต้นแค่ 899
 */
export function Hero({ monthlyTHB }: { monthlyTHB?: number }) {
  const shown = monthlyTHB === undefined ? plans : plansFor(monthlyTHB);
  const cheapest = Math.min(...shown.map((p) => p.perMonthTHB));

  return (
    // ระยะบนน้อยกว่า --sp-hero เดิม (สูงสุด 9.5rem) เพราะต้องเอาพื้นที่ไปให้คลิปพ้น fold
    // ไม่ไปแก้ที่ตัวโทเคน เพราะหน้าอื่นก็ใช้ --sp-hero อยู่
    <section id="top" className="hero-terminal relative overflow-hidden pb-[var(--sp-md)] pt-[clamp(4.5rem,3.5rem+4vw,6.5rem)]">
      <div className="hero-market-depth" aria-hidden>
        <span className="hero-market-depth__line hero-market-depth__line--one" />
        <span className="hero-market-depth__line hero-market-depth__line--two" />
        <span className="hero-market-depth__line hero-market-depth__line--three" />
        <span className="hero-market-depth__pulse" />
      </div>
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow rise rise-1">XAUUSD · Smart Money Concept</p>

          {/* เพดานเล็กลงจาก 4.4rem เหลือ 3.7rem — สองบรรทัดเตี้ยลงราว 35px
              ยังใหญ่กว่าหัวข้อ section ทุกอันชัดเจน ลำดับความสำคัญไม่เสีย */}
          <h1 className="display rise rise-2 mt-5 text-[clamp(2.4rem,1.5rem+3.4vw,3.7rem)]">
            อ่านกราฟทองคำ
            <br />
            <span className="text-gradient-brand">ด้วยเทคนิคระดับโปร</span>
          </h1>

          {/* Chrome ตัดบรรทัดไทยด้วยพจนานุกรม ICU ที่ไม่รู้จักคำทับศัพท์ยาว ๆ
              ของเดิม max-w-xl ตัดเป็น "อินดิเค / เตอร์" พอขยายเป็น 2xl ก็ย้ายไปตัด
              "อีกต่อ / ไป" แทน แก้ด้วยความกว้างไม่ได้ ต้องล็อกวรรคนั้นไว้ทั้งก้อน
              (วิธีเดียวกับที่ TelegramAlerts และ EmailCapture ใช้อยู่) */}
          <p className="lede rise rise-2 mx-auto mt-5 max-w-2xl">
            เห็นโครงสร้างตลาด โซนสำคัญ และจุดเข้า–ออก อยู่บนกราฟเดียว{" "}
            <span className="whitespace-nowrap">ไม่ต้องสลับอินดิเคเตอร์ไปมาอีกต่อไป</span>
          </p>

          <div className="rise rise-3 mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
        <figure className="hero-chart-frame rise rise-4 relative mx-auto mt-10 max-w-5xl">
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

            {/* แถบจุดเด่น — อยู่ในกรอบเดียวกับกราฟ ไม่ใช่แถวลอยใต้ภาพเหมือนเดิม
                ได้สองอย่าง: ประหยัดความสูงราว 90px ให้คลิปพ้น fold
                และทำให้กรอบกราฟเป็นก้อนเดียวที่มีชั้น แทนที่จะเป็นบล็อกเรียงต่อกัน */}
            <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 border-t border-border px-4 pb-1.5 pt-3">
              {trustItems.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-xs text-muted">
                  <Icon name={t.icon} className="h-3.5 w-3.5 text-brand" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>

          <figcaption className="mt-3.5 text-center text-xs text-faint">
            คลิปจากกราฟจริงที่รันอินดิเคเตอร์ บันทึกในโหมด Bar Replay ของ TradingView ·
            เป็นการเดินย้อนหลังเพื่อสาธิต ไม่ใช่การเทรดสด และไม่ใช่การรับประกันผลในอนาคต
          </figcaption>
        </figure>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
          <ShieldCheck className="h-3.5 w-3.5" />
          เครื่องมือช่วยวิเคราะห์ ไม่ใช่สัญญาณการันตีกำไร — ผู้ใช้ตัดสินใจและบริหารความเสี่ยงเอง
        </p>
      </div>
    </section>
  );
}
