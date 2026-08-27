"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const presets = [
  {
    id: "smc", badge: "ชุด A", name: "SMC Unified", style: "อ่านโครงสร้างและโซน", image: "/images/charts/smc-suite-v2.webp",
    features: ["Market Structure", "OB / FVG / Liquidity", "Demand / Supply", "HTF 4H context"],
    controls: ["Strong zones", "Liquidity sweep", "NEXT zones", "Signal A / B"],
  },
  {
    id: "gold", badge: "ชุด B", name: "Gold Booster + Core", style: "Scalping ตามเทรนด์", image: "/images/charts/gold-suite-snap.webp",
    features: ["BUY / SELL labels", "EMA200 bias", "Supertrend trail", "TP / SL plan"],
    controls: ["Trend filter", "Dip / Rally", "Fixed TP / SL", "Long / Short"],
  },
  {
    id: "ict", badge: "ชุด C", name: "ICT SD Signal", style: "ICT / SMC Intraday", image: "/images/charts/ict-suite-v2.webp",
    features: ["ICT BUY / SELL", "Liquidity sweep", "London + NY filter", "EMA200 filter"],
    controls: ["Session filter", "Liquidity pool", "TP1 + BE", "Structure labels"],
  },
] as const;

export function ConfigurationShowcase() {
  const [activeId, setActiveId] = useState<(typeof presets)[number]["id"]>("smc");
  const active = presets.find((preset) => preset.id === activeId) ?? presets[0];

  return (
    <div>
      <SectionHeading align="center" eyebrow="Configuration showcase" title="หนึ่งระบบ ปรับมุมมองให้เข้ากับวิธีเทรด" subtitle="สลับดูตัวอย่างชุดตั้งค่าจริงทั้ง 3 แบบ ภาพและรายการด้านล่างอ้างอิงจากคู่มือ QVX" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[.7fr_1.45fr]">
        <div className="space-y-3" role="tablist" aria-label="เลือกชุดตั้งค่า">
          {presets.map((preset) => (
            <button key={preset.id} type="button" role="tab" aria-selected={active.id === preset.id} onClick={() => setActiveId(preset.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${active.id === preset.id ? "border-brand/45 bg-brand/8 shadow-[0_18px_50px_-35px_rgba(110,227,74,.7)]" : "border-border bg-surface hover:border-border-strong"}`}>
              <span className="text-[.65rem] font-semibold uppercase tracking-[.18em] text-brand">{preset.badge}</span>
              <span className="mt-1 block font-semibold">{preset.name}</span>
              <span className="mt-1 block text-xs text-muted">{preset.style}</span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-border-strong bg-surface">
          <div className="relative aspect-[1800/734] bg-black">
            {presets.map((preset) => (
              <Image key={preset.id} src={preset.image} alt={`ตัวอย่างกราฟชุด ${preset.name}`} fill sizes="(max-width: 1024px) 100vw, 68vw" className={`object-cover transition-opacity duration-500 ${active.id === preset.id ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={active.id !== preset.id} />
            ))}
            <div className="absolute left-4 top-4 rounded-full border border-brand/30 bg-background/85 px-3 py-1 text-xs font-semibold text-brand backdrop-blur-md">{active.badge} · {active.name}</div>
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6" aria-live="polite">
            <div><p className="flex items-center gap-2 text-sm font-semibold"><Check className="h-4 w-4 text-brand" aria-hidden />สิ่งที่เห็นบนกราฟ</p><ul className="mt-3 grid gap-2 text-sm text-muted">{active.features.map((item) => <li key={item}>• {item}</li>)}</ul></div>
            <div><p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-brand" aria-hidden />ตัวเลือกสำคัญ</p><ul className="mt-3 grid grid-cols-2 gap-2">{active.controls.map((item) => <li key={item} className="rounded-lg border border-border bg-background/50 px-2.5 py-2 text-xs text-muted">{item}</li>)}</ul></div>
          </div>
        </div>
      </div>
    </div>
  );
}
