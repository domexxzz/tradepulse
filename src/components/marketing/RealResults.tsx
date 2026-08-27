import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { guideSuites, mediaNote } from "@/config/guide";
import { LoopingClip } from "@/components/guide/LoopingClip";

/**
 * "เห็นของจริง" — สองบล็อกที่แยกที่มากันชัด ๆ
 *
 *   บล็อกบน  = ภาพ/คลิปที่เราแคปเอง จากโหมด Bar Replay บน TradingView
 *   บล็อกล่าง = ภาพที่มีลิงก์ snapshot ของ TradingView ให้กดตรวจสอบได้
 *
 * แยกกันเพราะสองอย่างนี้ตรวจสอบได้ไม่เท่ากัน เอามารวมกองเดียวแล้วกำกับว่า
 * "ผลงานจริงตรวจสอบได้" ทั้งหมดคือพูดเกินจริง — คลิป replay ไม่ใช่การเทรดสด
 */
export function RealResults() {
  const featured = guideSuites[0];
  const clip = featured.videos[0];

  return (
    <section id="results" className="section">
      <div className="container-x">
        {/*
          เรียงคำแบบนี้เพื่อให้จุดตัดบรรทัดตกที่ช่องว่าง — ดูหมายเหตุที่ .display ใน globals.css
          ("หน้าชาร์ตจริงจากอินดิเคเตอร์ทั้ง 3 ชุด" จะถูก Chrome ตัดเป็น "จา / กอินดิเคเตอร์")
        */}
        <SectionHeading
          eyebrow="เห็นของจริง · ก่อนตัดสินใจ"
          title="อินดิเคเตอร์ทั้ง 3 ชุด บนหน้าชาร์ตจริง"
          subtitle="ภาพที่แคปจากการเปิดใช้งานจริงบน XAUUSD — โครงสร้างตลาด โซนสำคัญ สัญญาณเข้า และแผน TP/SL ที่ระบบวางให้"
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {guideSuites.map((s) => (
            <Link
              key={s.id}
              href={`/guide#${s.id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface/60 transition-colors hover:border-brand/40"
            >
              <Image
                src={s.chart.src}
                alt={s.chart.alt}
                width={s.chart.width}
                height={s.chart.height}
                className="h-auto w-full border-b border-border"
                sizes="(max-width: 1024px) 100vw, 33vw"
              />
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  {s.badge}
                </p>
                <h3 className="mt-1 font-display text-base font-semibold leading-tight">{s.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.bestFor}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  ดูค่าตั้งของชุดนี้
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <figure className="overflow-hidden rounded-2xl border border-border bg-surface p-1.5">
            <LoopingClip src={clip.src} poster={clip.poster} label={clip.label} />
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
              <span>{clip.label}</span>
              <span className="tabular-nums">วนซ้ำ · {clip.duration}</span>
            </figcaption>
          </figure>

          <div className="flex flex-col justify-center gap-4 rounded-2xl border border-brand/25 bg-brand/5 p-6">
            <h3 className="font-display text-lg font-bold">อยากได้หน้าชาร์ตแบบนี้?</h3>
            <p className="text-sm leading-relaxed text-muted">
              ค่าตั้งทุกช่องที่ทำให้ได้ภาพเหล่านี้ เขียนไว้ครบในคู่มือแล้ว — เปิดฟังก์ชันไหน
              ใส่ตัวเลขเท่าไร ใช้ตอนไหน และไม่ควรใช้ตอนไหน
            </p>
            <Link
              href="/guide"
              className="inline-flex h-11 w-fit items-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
            >
              เปิดคู่มือตั้งค่า
            </Link>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">{mediaNote}</p>

        {/* ภาพที่กดไปตรวจสอบบน TradingView ได้จริง — คนละที่มากับบล็อกข้างบน */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <figure className="card-surface flex flex-col overflow-hidden rounded-2xl p-1.5">
            <Image
              src="/images/result-xauusd.png"
              alt="ภาพผลลัพธ์จากอินดิเคเตอร์ QVX บนกราฟ XAUUSD แสดงสัญญาณและแนวโน้มบน TradingView"
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

          <figure className="card-surface overflow-hidden rounded-2xl p-1.5">
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
              alt="เส้นผลการทำงานสะสมของระบบ QVX จากสัญญาณย้อนหลัง แสดงบน TradingView"
              width={1764}
              height={509}
              className="h-auto w-full rounded-xl border border-border"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </figure>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
          ภาพ คลิป และเส้นผลการทำงานเป็นข้อมูลย้อนหลังเพื่อประกอบการอธิบายการทำงานของระบบ
          ไม่ใช่คำแนะนำการลงทุน • ผลในอดีตไม่ได้รับประกันผลในอนาคต การเทรดมีความเสี่ยง
        </p>
      </div>
    </section>
  );
}
