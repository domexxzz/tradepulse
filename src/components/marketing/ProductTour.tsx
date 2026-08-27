"use client";

import Image from "next/image";
import { useState } from "react";
import { Boxes, Crosshair, Droplets, Route } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const tourItems = [
  { id: "structure", label: "BOS / CHoCH", title: "เห็นจังหวะที่โครงสร้างเปลี่ยน", detail: "ระบบติดป้าย BOS และ CHoCH บนกราฟ ช่วยแยกจังหวะไปต่อออกจากจังหวะกลับตัว", x: 44, y: 42, Icon: Route },
  { id: "fvg", label: "FVG", title: "รอราคาเข้า Imbalance แทนการไล่ราคา", detail: "มองเห็นช่องว่างราคาที่ตลาดอาจย้อนกลับมาเติม ใช้ประกอบการวางแผนจุดรอ ไม่ใช่เดาสุ่มกลางทาง", x: 58, y: 55, Icon: Boxes },
  { id: "liquidity", label: "Liquidity", title: "รู้ว่าตลาดกำลังไล่เก็บสภาพคล่องตรงไหน", detail: "จุด Liquidity และ Sweep ช่วยให้เห็นบริเวณที่มีโอกาสเกิดแรงตอบสนองก่อนตัดสินใจ", x: 28, y: 67, Icon: Droplets },
  { id: "zones", label: "OB / Zone", title: "รวมโซนตัดสินใจไว้บนชาร์ตเดียว", detail: "Order Block, Demand/Supply และโซนถัดไปอยู่ในบริบทเดียวกับโครงสร้างตลาด", x: 73, y: 32, Icon: Crosshair },
] as const;

export function ProductTour() {
  const [activeId, setActiveId] = useState<(typeof tourItems)[number]["id"]>("structure");
  const active = tourItems.find((item) => item.id === activeId) ?? tourItems[0];

  return (
    <div className="container-x pb-12 pt-8 sm:pb-16">
      <SectionHeading align="center" eyebrow="Interactive product tour" title="กดดูว่าแต่ละจุดบนกราฟช่วยอ่านอะไร" subtitle="ใช้ภาพจากหน้าชาร์ตจริงของชุด SMC — เลือกเครื่องมือด้านล่างเพื่อดูตำแหน่งและบริบทบนกราฟ" />

      <div className="mt-8 overflow-hidden rounded-3xl border border-border-strong bg-surface shadow-[0_30px_100px_-60px_rgba(110,227,74,.45)] lg:grid lg:grid-cols-[1.55fr_.75fr]">
        <div className="relative aspect-[1800/734] min-h-[250px] overflow-hidden bg-black sm:min-h-0">
          <Image src="/images/charts/smc-suite-v2.webp" alt="หน้าชาร์ตจริงของ QVX แสดง Market Structure, FVG, Liquidity และ Order Block" fill sizes="(max-width: 1024px) 100vw, 70vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_55%,rgba(6,10,7,.45))]" />
          {tourItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={`ดูคำอธิบาย ${item.label}`}
              aria-pressed={active.id === item.id}
              onClick={() => setActiveId(item.id)}
              className={`tour-hotspot ${active.id === item.id ? "tour-hotspot--active" : ""}`}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex min-h-64 flex-col justify-between p-6 sm:p-8">
          <div aria-live="polite">
            <active.Icon className="h-7 w-7 text-brand" aria-hidden />
            <p className="eyebrow mt-5">{active.label}</p>
            <h3 className="display mt-3 text-2xl">{active.title}</h3>
            <p className="mt-4 text-sm leading-7 text-muted">{active.detail}</p>
          </div>
          <div className="mt-7 grid grid-cols-4 gap-2" role="tablist" aria-label="เลือกเครื่องมือบนกราฟ">
            {tourItems.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={active.id === item.id} onClick={() => setActiveId(item.id)} className={`h-1.5 rounded-full transition-colors ${active.id === item.id ? "bg-brand" : "bg-border-strong hover:bg-muted"}`}>
                <span className="sr-only">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-faint">ภาพจาก TradingView Bar Replay เพื่อสาธิตเครื่องมือ ไม่ใช่คำแนะนำหรือการรับประกันผลกำไร</p>
    </div>
  );
}
