"use client";
import { useState } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MockChart } from "./MockChart";
import { cn } from "@/lib/utils";

const legend = [
  { color: "#f3f7f1", label: "Entry", desc: "ราคาที่ระบบแนะนำให้เข้าเทรด" },
  { color: "#65e62c", label: "TP (Take Profit)", desc: "เป้าหมายทำกำไร" },
  { color: "#d85b5b", label: "SL (Stop Loss)", desc: "จุดตัดขาดทุนเมื่อราคาผิดทาง" },
  { color: "#65e62c", label: "Trend / Signal", desc: "ทิศทางตลาดและจังหวะเข้าเทรด" },
];

export function Demo() {
  const [variant, setVariant] = useState<"buy" | "sell">("buy");

  return (
    <section id="demo" className="border-y border-border bg-surface py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="เดโม"
          title="ดูระบบทำงานก่อนตัดสินใจ"
          subtitle="เห็นภาพว่าอินดิเคเตอร์แสดงอะไรบนกราฟ พร้อมความหมายของแต่ละองค์ประกอบ"
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="card-soft rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-border bg-background p-1" role="group" aria-label="เลือกตัวอย่างสัญญาณ">
                {(["buy", "sell"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    aria-pressed={variant === v}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      variant === v ? "bg-brand text-background" : "text-muted hover:text-foreground"
                    )}
                  >
                    ดูตัวอย่าง {v === "buy" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] text-muted">
                ภาพตัวอย่างการใช้งาน
              </span>
            </div>
            <div className="aspect-[16/10] w-full">
              <MockChart variant={variant} />
            </div>
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
              ข้อมูลในภาพเป็นตัวอย่างเพื่ออธิบายการทำงาน ไม่ใช่คำแนะนำการลงทุน
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
