import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { guideSuites } from "@/config/guide";

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
  return (
    <div id="results" className="pt-10 sm:pt-12">
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

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted">
          ภาพทั้งสามชุดเป็นหน้าชาร์ตจริงจาก XAUUSD เพื่อให้เห็นว่าระบบวาดโซน โครงสร้าง และสัญญาณอย่างไร
          ไม่ใช่คำแนะนำการลงทุน และผลในอดีตไม่ได้รับประกันผลในอนาคต
        </p>
      </div>
    </div>
  );
}
