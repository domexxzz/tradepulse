"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

const STORAGE_KEY = "qvx:guide-checklist:v1";

export function SetupChecklist({ suiteId, steps }: { suiteId: string; steps: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => steps.map(() => false));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
        const saved = parsed[suiteId];
        if (Array.isArray(saved)) setChecked(steps.map((_, index) => saved[index] === true));
      } catch { /* Ignore malformed local-only state. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [steps, suiteId]);

  const update = (index: number, value: boolean) => {
    setChecked((current) => {
      const next = current.map((item, itemIndex) => itemIndex === index ? value : item);
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, [suiteId]: next }));
      } catch { /* Checklist still works in memory if storage is unavailable. */ }
      return next;
    });
  };

  const complete = checked.filter(Boolean).length;
  const reset = () => {
    const next = steps.map(() => false);
    setChecked(next);
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, [suiteId]: next }));
    } catch { /* Keep the in-memory reset. */ }
  };
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface/60 p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-display text-lg font-semibold">Checklist ตั้งค่าตามจริง</h3><p className="mt-1 text-xs text-muted">บันทึกความคืบหน้าเฉพาะในเบราว์เซอร์เครื่องนี้</p></div><button type="button" onClick={reset} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-brand" aria-label="รีเซ็ต checklist"><RotateCcw className="h-4 w-4" /></button></div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border"><span className="block h-full bg-brand transition-[width]" style={{ width: `${steps.length ? (complete / steps.length) * 100 : 0}%` }} /></div>
      <p className="mt-2 text-right text-[11px] text-muted" aria-live="polite">{hydrated ? `${complete}/${steps.length} ขั้นตอน` : "กำลังโหลด…"}</p>
      <ol className="mt-3 space-y-2">{steps.map((step, index) => <li key={step}><label className="flex cursor-pointer gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-border hover:bg-background/30"><input type="checkbox" checked={checked[index] ?? false} onChange={(event) => update(index, event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand)]" /><span className={`text-sm leading-relaxed ${checked[index] ? "text-muted line-through" : "text-foreground/85"}`}>{step}</span></label></li>)}</ol>
    </div>
  );
}
