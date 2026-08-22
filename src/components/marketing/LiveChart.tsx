"use client";
import { useState } from "react";
import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { TradingViewChart } from "./TradingViewChart";
import { tradingView, hasChartSnapshot } from "@/config/site";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
] as const;

type Mode = "snapshot" | "live";

export function LiveChart() {
  const [mode, setMode] = useState<Mode>(hasChartSnapshot ? "snapshot" : "live");
  const [activeInterval, setActiveInterval] = useState<string>(tradingView.interval);

  return (
    <section id="chart" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="กราฟจริง"
          title="กราฟทองคำ XAUUSD ที่ติดตั้ง TradePulse"
          subtitle="ดูภาพกราฟจริงที่รันอินดิเคเตอร์ของเรา พร้อมราคาตลาดแบบเรียลไทม์ในหน้าเดียว"
        />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {hasChartSnapshot ? (
            <div
              className="inline-flex rounded-full border border-border bg-surface p-1"
              role="group"
              aria-label="เลือกมุมมองกราฟ"
            >
              {([
                { value: "snapshot", label: "กราฟ TradePulse" },
                { value: "live", label: "ราคา Live" },
              ] as const).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  aria-pressed={mode === m.value}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    mode === m.value ? "bg-brand text-background" : "text-muted hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {tradingView.symbol.split(":").pop()} · ราคาตลาดจริง
            </span>
          )}

          <Button href={tradingView.chartUrl} target="_blank" rel="noopener noreferrer" variant="outline">
            เปิดกราฟจริงบน TradingView ↗
          </Button>
        </div>

        {mode === "live" && (
          <div
            className="mt-4 inline-flex rounded-full border border-border bg-surface p-1"
            role="group"
            aria-label="เลือกไทม์เฟรมของกราฟ"
          >
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setActiveInterval(tf.value)}
                aria-pressed={activeInterval === tf.value}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeInterval === tf.value ? "bg-brand text-background" : "text-muted hover:text-foreground"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-border card-surface p-1.5">
          <div className="h-[420px] w-full sm:h-[500px]">
            {mode === "snapshot" && hasChartSnapshot ? (
              <a
                href={tradingView.chartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-full w-full overflow-hidden rounded-xl"
                aria-label="เปิดกราฟจริงบน TradingView"
              >
                <Image
                  src={tradingView.snapshotUrl}
                  alt="กราฟ XAUUSD ที่ติดตั้งอินดิเคเตอร์ TradePulse แสดง Entry, TP, SL และโซน Supply/Demand"
                  fill
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-contain"
                  priority
                />
              </a>
            ) : (
              <TradingViewChart symbol={tradingView.symbol} interval={activeInterval} />
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          {mode === "snapshot" && hasChartSnapshot
            ? "ภาพจากกราฟจริงที่รันอินดิเคเตอร์ TradePulse • ผลในอดีตไม่ใช่การรับประกันผลในอนาคต"
            : "ข้อมูลราคาเป็นของตลาดจริงจาก TradingView"}{" "}
          • TradePulse ไม่มีส่วนเกี่ยวข้องกับ TradingView
        </p>
      </div>
    </section>
  );
}
