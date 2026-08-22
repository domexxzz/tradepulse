import { Button } from "@/components/ui/Button";
import Image from "next/image";
import { chartExamples } from "@/config/site";
import { ShieldCheck } from "lucide-react";

export function Hero() {
  const hero = chartExamples[0];

  return (
    <section id="top" className="hero-backdrop relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        {/* copy */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Indicator for XAUUSD on TradingView
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.15] sm:text-5xl">
            เห็นจังหวะทองคำชัดขึ้น
            <br />
            <span className="text-gradient-brand">วางแผนก่อนเข้าเทรด</span>
          </h1>
          <p className="mt-5 max-w-xl text-muted sm:text-lg">
            TradePulse รวม Trend, Buy/Sell Signal, Entry, TP/SL และ Risk Management ไว้ในระบบเดียว
            เพื่อช่วยให้คุณตัดสินใจอย่างมีแผนมากขึ้น
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="#demo" size="lg">ดู Demo การใช้งาน</Button>
            <Button href="#pricing" variant="outline" size="lg">เริ่มต้น ฿990/เดือน</Button>
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            ไม่ใช่สัญญาณการันตีกำไร • ผู้ใช้ต้องตัดสินใจและบริหารความเสี่ยงด้วยตนเอง
          </p>
        </div>

        {/* visual — ภาพจากกราฟจริงที่รันอินดิเคเตอร์ ไม่ใช่ภาพจำลอง */}
        <div className="relative">
          <div className="card-surface overflow-hidden rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">XAUUSD · {hero.tf}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                จากกราฟจริง
              </span>
            </div>
            <a
              href={hero.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              /* ภาพต้นฉบับกว้าง ~4:1 ถ้าใส่เต็มจะเหลือแถบบางอ่านไม่ออก
                 จึงครอบเป็น 16:10 เกาะกึ่งกลาง ตรงที่มีแท่งเทียน ป้าย LONG และโซน FVG/OB
                 (เกาะขวาแล้วได้แต่พื้นที่ว่างกับแผงสถิติ ไม่เห็นกราฟ) */
              className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl"
              aria-label="เปิดภาพกราฟเต็มบน TradingView"
            >
              <Image
                src={hero.url}
                alt={`กราฟ XAUUSD ที่รันอินดิเคเตอร์ TradePulse — ${hero.caption}`}
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover object-center"
                priority
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
