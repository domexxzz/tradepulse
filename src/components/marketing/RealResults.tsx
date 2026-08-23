import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ExternalLink } from "lucide-react";

export function RealResults() {
  return (
    <section id="results" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="ผลลัพธ์จริง"
          title="อินดิเคเตอร์ทำงานจริงบนกราฟทองคำ"
          subtitle="คลิปและภาพจากการใช้งานจริงบน TradingView แสดง Trend, สัญญาณ และการวางแผน Entry / TP / SL"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <figure className="card-surface overflow-hidden rounded-2xl p-1.5">
            <video
              className="w-full rounded-xl"
              controls
              preload="metadata"
              playsInline
              poster="/images/result-xauusd.png"
              aria-label="คลิปการใช้งานอินดิเคเตอร์ TradePulse บนกราฟทองคำ XAUUSD"
            >
              <source src="/videos/demo.mp4" type="video/mp4" />
              เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
            </video>
            <figcaption className="px-3 py-2 text-xs text-muted">
              คลิปการใช้งานจริงบน TradingView (~26 วินาที)
            </figcaption>
          </figure>

          <figure className="card-surface flex flex-col overflow-hidden rounded-2xl p-1.5">
            <Image
              src="/images/result-xauusd.png"
              alt="ภาพผลลัพธ์จากอินดิเคเตอร์ TradePulse บนกราฟ XAUUSD แสดงสัญญาณและแนวโน้มบน TradingView"
              width={1814}
              height={921}
              className="h-auto w-full rounded-xl border border-border"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
              <span>ภาพจากกราฟจริง (XAUUSD)</span>
              <a
                href="https://www.tradingview.com/x/fDqsBSbN/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                ดูบน TradingView <ExternalLink className="h-3 w-3" />
              </a>
            </figcaption>
          </figure>
        </div>

        {/* performance / equity curve */}
        <figure className="card-surface mt-6 overflow-hidden rounded-2xl p-1.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
            <span className="text-sm font-semibold">ผลการทำงานสะสมของระบบ (ย้อนหลัง)</span>
            <a
              href="https://www.tradingview.com/x/wtpTag6b/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              แสดงผลบน TradingView <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Image
            src="/images/performance-curve.png"
            alt="เส้นผลการทำงานสะสมของระบบ TradePulse จากสัญญาณย้อนหลัง แสดงบน TradingView"
            width={1764}
            height={509}
            className="h-auto w-full rounded-xl border border-border"
            sizes="100vw"
          />
        </figure>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
          ภาพ คลิป และเส้นผลการทำงานเป็นข้อมูลย้อนหลังเพื่อประกอบการอธิบายการทำงานของระบบ
          ไม่ใช่คำแนะนำการลงทุน • ผลในอดีตไม่ได้รับประกันผลในอนาคต การเทรดมีความเสี่ยง
        </p>
      </div>
    </section>
  );
}
