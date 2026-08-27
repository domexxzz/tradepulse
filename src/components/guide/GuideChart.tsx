"use client";

import Image from "next/image";
import { useState } from "react";
import type { GuideImage } from "@/config/guide";

const hotspotMap = {
  smc: [["BOS / CHoCH", 38, 48], ["FVG", 60, 56], ["Liquidity", 25, 70], ["OB / Zone", 72, 34]],
  gold: [["BUY / SELL", 46, 45], ["Supertrend", 57, 61], ["EMA200", 68, 75], ["TP / SL", 79, 37]],
  ict: [["ICT Signal", 48, 50], ["Liquidity", 30, 68], ["EMA200", 70, 77], ["TP1 / BE", 78, 40]],
} as const;

export function GuideChart({ suiteId, suiteName, chart }: { suiteId: string; suiteName: string; chart: GuideImage }) {
  const hotspots = hotspotMap[suiteId as keyof typeof hotspotMap] ?? hotspotMap.smc;
  const [active, setActive] = useState<string>(hotspots[0][0]);
  return <figure className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface p-1.5"><div className="relative overflow-hidden rounded-xl"><Image src={chart.src} alt={chart.alt} width={chart.width} height={chart.height} className="h-auto w-full" sizes="(max-width: 1024px) 100vw, 1000px" />{hotspots.map(([label, x, y]) => <button key={label} type="button" aria-pressed={active === label} onClick={() => setActive(label)} className={`guide-hotspot ${active === label ? "guide-hotspot--active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}><span>{label}</span></button>)}</div><figcaption className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted"><span>ตัวอย่างหน้าชาร์ต XAUUSD เมื่อเปิด {suiteName}</span><span className="hidden text-brand sm:inline">แตะจุดเรืองแสงเพื่อดูตำแหน่ง</span></figcaption></figure>;
}
