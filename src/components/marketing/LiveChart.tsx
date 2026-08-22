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
          {mode === "snapshot" && hasChartSnapshot ? (
            // ภาพกราฟแบนมาก (~4:1) — บนมือถือจึงตรึงความสูงแล้วให้เลื่อนแนวนอนแทนการย่อจนอ่านไม่ออก
            <div className="overflow-x-auto sm:overflow-x-visible">
            <a
              href={tradingView.snapshotPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block h-[240px] w-auto overflow-hidden rounded-xl sm:h-auto sm:w-full"
              style={{ aspectRatio: tradingView.snapshotAspect }}
              aria-label="เปิดภาพกราฟเต็มบน TradingView"
            >
              <Image
                src={tradingView.snapshotUrl}
                alt="กราฟ XAUUSD ที่ติดตั้งอินดิเคเตอร์ TradePulse แสดงสัญญาณ Long/Sell, โซน FVG และ Order Block"
                fill
                sizes="(max-width: 1280px) 100vw, 1200px"
                className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                priority
              />
            </a>
            </div>
          ) : (
            <div className="h-[420px] w-full sm:h-[500px]">
              <TradingViewChart symbol={tradingView.symbol} interval={activeInterval} />
            </div>
          )}
        </div>

        {mode === "snapshot" && hasChartSnapshot && (
          <p className="mt-2 text-center text-[11px] text-muted sm:hidden">
            เลื่อนซ้าย–ขวาเพื่อดูกราฟทั้งหมด
          </p>
        )}

        <p className="mt-3 text-center text-xs text-muted">
          {mode === "snapshot" && hasChartSnapshot
            ? "ภาพจากกราฟจริงที่รันอินดิเคเตอร์ TradePulse • ตัวเลข Win Rate / Profit Factor / Net PnL บนภาพเป็นผลทดสอบย้อนหลัง (backtest) ของช่วงเวลาที่แสดง ไม่ใช่ผลเทรดจริง และไม่ใช่การรับประกันผลในอนาคต"
            : "ข้อมูลราคาเป็นของตลาดจริงจาก TradingView"}{" "}
          • TradePulse ไม่มีส่วนเกี่ยวข้องกับ TradingView
        </p>
      </div>
    </section>
  );
}
