"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Lock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Signal {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  tf: string;
  createdAt: string;
  price?: number;
  sl?: number | null;
  tp1?: number | null;
  tp2?: number | null;
}

const POLL_MS = 30_000;

function tfLabel(tf: string) {
  if (/^\d+$/.test(tf)) {
    const n = Number(tf);
    return n >= 60 ? `H${n / 60}` : `M${n}`;
  }
  return tf;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "เมื่อสักครู่";
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

export function LiveSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [locked, setLocked] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/signals", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setSignals(data.signals ?? []);
        setLocked(Boolean(data.locked));
      } catch {
        // เงียบไว้ — ฟีดสัญญาณล่มไม่ควรทำให้หน้าเว็บพัง
      } finally {
        if (alive) setLoaded(true);
      }
    };
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // ยังไม่มีสัญญาณเลย = ไม่ต้องโชว์ section ว่าง ๆ ให้ดูเหมือนเว็บพัง
  if (loaded && signals.length === 0) return null;

  return (
    <section id="signals" className="border-y border-border bg-surface py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="สัญญาณล่าสุด"
          title="สัญญาณที่ระบบส่งออกมาจริง"
          subtitle="ยิงตรงจากอินดิเคเตอร์บน TradingView เข้าเว็บทันทีที่แท่งเทียนปิด"
        />

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {!loaded &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl border border-border bg-background" />
            ))}

          {signals.map((s) => {
            const isBuy = s.side === "BUY";
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-background p-4"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                    isBuy ? "bg-up/15 text-up" : "bg-down/15 text-down"
                  )}
                >
                  {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {s.side}
                </span>

                <div className="mr-auto">
                  <div className="text-sm font-semibold">{s.symbol}</div>
                  <div className="text-xs text-muted">
                    {tfLabel(s.tf)} · {timeAgo(s.createdAt)}
                  </div>
                </div>

                {locked ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted">
                    <Lock className="h-3.5 w-3.5" />
                    Entry / TP / SL เฉพาะสมาชิก
                  </span>
                ) : (
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <div>
                      <dt className="text-muted">Entry</dt>
                      <dd className="font-semibold tabular-nums">{s.price?.toFixed(2)}</dd>
                    </div>
                    {s.sl != null && (
                      <div>
                        <dt className="text-muted">SL</dt>
                        <dd className="font-semibold tabular-nums text-down">{s.sl.toFixed(2)}</dd>
                      </div>
                    )}
                    {s.tp1 != null && (
                      <div>
                        <dt className="text-muted">TP1</dt>
                        <dd className="font-semibold tabular-nums text-up">{s.tp1.toFixed(2)}</dd>
                      </div>
                    )}
                    {s.tp2 != null && (
                      <div>
                        <dt className="text-muted">TP2</dt>
                        <dd className="font-semibold tabular-nums text-up">{s.tp2.toFixed(2)}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            );
          })}
        </div>

        {locked && loaded && signals.length > 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            <Link href="#pricing" className="font-medium text-brand hover:underline">
              สมัครสมาชิก
            </Link>{" "}
            เพื่อดูจุดเข้า เป้าหมาย และจุดตัดขาดทุนของทุกสัญญาณ
          </p>
        )}

        <p className="mt-3 text-center text-xs text-muted">
          สัญญาณเป็นผลจากการวิเคราะห์ของระบบ ไม่ใช่คำแนะนำการลงทุน
        </p>
      </div>
    </section>
  );
}
