"use client";
import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

interface Signal {
  id: string;
  timeframe: string;
  side: string | null;
  symbol: string | null;
  entry: string | null;
  tp: string | null;
  sl: string | null;
  createdAt: string;
}

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

export function LiveSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/signals", { cache: "no-store" });
        const data = await res.json();
        if (alive) {
          setSignals(Array.isArray(data.signals) ? data.signals : []);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section id="signals" className="border-y border-border bg-surface py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="สัญญาณสด"
          title="สัญญาณจากระบบแบบเรียลไทม์"
          subtitle="อัปเดตอัตโนมัติเมื่ออินดิเคเตอร์ยิงสัญญาณ (ตัวอย่างการทำงานจริง ไม่ใช่คำแนะนำการลงทุน)"
        />

        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-2 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          LIVE · อัปเดตทุก 15 วินาที
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3">
          {!loaded ? (
            <div className="card-surface rounded-2xl p-6 text-center text-sm text-muted">กำลังโหลด…</div>
          ) : signals.length === 0 ? (
            <div className="card-surface rounded-2xl p-8 text-center text-sm text-muted">
              ยังไม่มีสัญญาณล่าสุด — รอจังหวะที่อินดิเคเตอร์ยิงสัญญาณ
            </div>
          ) : (
            signals.map((s) => {
              const buy = s.side === "BUY";
              const sell = s.side === "SELL";
              return (
                <div key={s.id} className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl p-4">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-bold",
                      buy && "bg-up/15 text-up",
                      sell && "bg-down/15 text-down",
                      !buy && !sell && "bg-surface-2 text-muted"
                    )}
                  >
                    {s.side ?? "SIGNAL"}
                  </span>
                  <span className="font-semibold">{s.symbol ?? "XAUUSD"}</span>
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted">{s.timeframe}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {s.entry && <span>Entry <b className="text-foreground">{s.entry}</b></span>}
                    {s.tp && <span>TP <b className="text-up">{s.tp}</b></span>}
                    {s.sl && <span>SL <b className="text-down">{s.sl}</b></span>}
                  </div>
                  <span className="ml-auto text-xs text-muted">{ago(s.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
