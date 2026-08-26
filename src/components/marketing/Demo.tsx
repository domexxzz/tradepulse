"use client";
import { useState } from "react";
import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { chartExamples } from "@/config/site";
import { cn } from "@/lib/utils";

const legend = [
  { color: "#f3f7f1", label: "Entry", desc: "ราคาที่ระบบแนะนำให้เข้าเทรด" },
  { color: "#65e62c", label: "TP1 / TP2", desc: "เป้าหมายทำกำไรสองชั้น คำนวณจาก ATR" },
  { color: "#d85b5b", label: "SL (Stop Loss)", desc: "จุดตัดขาดทุนเมื่อราคาผิดทาง" },
  { color: "#3fb6d8", label: "OB / FVG / โซน", desc: "Order Block และ Fair Value Gap ที่ระบบตีให้อัตโนมัติ" },
  { color: "#e6a52c", label: "NEXT Supply / Demand", desc: "ระดับสำคัญถัดไปที่ราคายังไปไม่ถึง" },
];

export function Demo() {
  const [active, setActive] = useState(0);
  const example = chartExamples[active] ?? chartExamples[0];
  const hasTabs = chartExamples.length > 1;

  if (!example) return null;

  return (
    <section id="demo" className="border-y border-border bg-surface py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="เดโม"
          title="ผลลัพธ์จริงจากอินดิเคเตอร์"
          subtitle="ภาพจากกราฟที่รันสคริปต์จริง ไม่ใช่ภาพจำลอง — ดูว่าระบบตีโซนและวางแผนให้อย่างไร"
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="card-soft rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {hasTabs ? (
                <div className="inline-flex rounded-full border border-border bg-background p-1" role="group" aria-label="เลือกตัวอย่างกราฟ">
                  {chartExamples.map((ex, i) => (
                    <button
                      key={ex.url}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-pressed={active === i}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                        active === i ? "bg-brand text-brand-ink" : "text-muted hover:text-foreground"
                      )}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
                  {example.label}
                </span>
              )}
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] text-muted">
                XAUUSD · {example.tf} · จากกราฟจริง
              </span>
            </div>

            {/* ภาพกราฟแบนมาก — มือถือตรึงความสูงแล้วเลื่อนแนวนอนแทนการย่อจนอ่านไม่ออก */}
            <div className="overflow-x-auto sm:overflow-x-visible">
              <a
                href={example.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block h-[240px] w-auto overflow-hidden rounded-xl sm:h-auto sm:w-full"
                style={{ aspectRatio: example.aspect }}
                aria-label={`เปิดภาพกราฟ ${example.label} เต็มบน TradingView`}
              >
                <Image
                  src={example.url}
                  alt={`ตัวอย่างผลลัพธ์อินดิเคเตอร์ TradePulse บนกราฟ XAUUSD ${example.tf} — ${example.caption}`}
                  fill
                  sizes="(max-width: 1280px) 100vw, 900px"
                  className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </a>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted sm:hidden">เลื่อนซ้าย–ขวาเพื่อดูกราฟทั้งหมด</p>
            <p className="mt-3 text-sm text-muted">{example.caption}</p>
          </div>

          <div>
            <h3 className="font-display text-lg font-semibold">องค์ประกอบบนกราฟ</h3>
            <ul className="mt-4 space-y-3">
              {legend.map((l) => (
                <li key={l.label} className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                  <div>
                    <div className="text-sm font-semibold">{l.label}</div>
                    <div className="text-sm text-muted">{l.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl border border-border bg-background p-4 text-xs text-muted">
              ภาพเป็นผลลัพธ์จริงของระบบในช่วงเวลาที่แสดง ตัวเลขสถิติบนกราฟเป็นผลทดสอบย้อนหลัง (backtest)
              ไม่ใช่ผลเทรดจริงและไม่ใช่การรับประกันผลในอนาคต
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
