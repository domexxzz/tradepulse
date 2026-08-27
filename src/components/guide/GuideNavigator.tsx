"use client";

import { useEffect, useState } from "react";
import { BookOpen, Gauge, Layers3, Radar, TrendingUp } from "lucide-react";

const navItems = [
  { id: "overview", label: "ภาพรวม" },
  { id: "smc", label: "ชุด A · SMC" },
  { id: "gold", label: "ชุด B · Gold" },
  { id: "ict", label: "ชุด C · ICT" },
  { id: "cautions", label: "ข้อควรระวัง" },
] as const;

const recommendations = [
  { href: "#smc", title: "อยากอ่านโครงสร้างและโซน", detail: "BOS · CHoCH · OB · FVG · Liquidity", Icon: Layers3 },
  { href: "#gold", title: "อยากได้จังหวะตามเทรนด์ชัด ๆ", detail: "EMA200 · Supertrend · BUY/SELL · TP/SL", Icon: TrendingUp },
  { href: "#ict", title: "เทรดช่วง London / New York", detail: "Sweep · ICT BUY/SELL · Session filter", Icon: Radar },
] as const;

export function GuideNavigator() {
  const [activeId, setActiveId] = useState("overview");
  const [quickMode, setQuickMode] = useState(false);

  useEffect(() => {
    const elements = navItems.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveId(visible.target.id);
    }, { rootMargin: "-18% 0px -66%", threshold: [0, 0.2, 0.5] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("guide-mode-quick", quickMode);
    return () => document.documentElement.classList.remove("guide-mode-quick");
  }, [quickMode]);

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeId));

  return (
    <>
      <section aria-labelledby="choose-suite" className="mt-8 rounded-2xl border border-border-strong bg-surface/70 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="eyebrow">เลือกจากสไตล์ของคุณ</p><h2 id="choose-suite" className="mt-2 font-display text-xl font-bold">ควรเริ่มอ่านชุดไหนก่อน?</h2></div>
          <button type="button" aria-pressed={quickMode} onClick={() => setQuickMode((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 text-sm font-medium text-brand hover:bg-brand/10">
            {quickMode ? <BookOpen className="h-4 w-4" aria-hidden /> : <Gauge className="h-4 w-4" aria-hidden />}
            {quickMode ? "แสดงฉบับละเอียด" : "เปิดโหมดตั้งค่าด่วน"}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {recommendations.map(({ href, title, detail, Icon }) => <a key={href} href={href} className="group rounded-xl border border-border bg-background/45 p-4 transition-colors hover:border-brand/35 hover:bg-brand/5"><Icon className="h-5 w-5 text-brand" aria-hidden /><h3 className="mt-3 text-sm font-semibold group-hover:text-brand">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></a>)}
        </div>
      </section>

      <nav aria-label="สารบัญคู่มือ" className="guide-sticky-nav sticky top-16 z-30 -mx-2 mt-8 overflow-hidden rounded-2xl border border-border-strong bg-background/90 p-2 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-border"><span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${((activeIndex + 1) / navItems.length) * 100}%` }} /></div>
        <div className="flex gap-1 overflow-x-auto pt-0.5">
          {navItems.map((item) => <a key={item.id} href={`#${item.id}`} aria-current={activeId === item.id ? "location" : undefined} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:flex-1 sm:text-center ${activeId === item.id ? "bg-brand text-brand-ink" : "text-muted hover:bg-surface hover:text-foreground"}`}>{item.label}</a>)}
        </div>
      </nav>
    </>
  );
}
