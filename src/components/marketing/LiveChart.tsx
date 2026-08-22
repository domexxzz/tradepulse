"use client";
import { useState } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { TradingViewChart } from "./TradingViewChart";
import { tradingView } from "@/config/site";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
] as const;

export function LiveChart() {
  const [activeInterval, setActiveInterval] = useState<string>(tradingView.interval);

  return (
    <section id="chart" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="ราคาเรียลไทม์"
          title="กราฟทองคำ XAUUSD แบบเรียลไทม์"
          subtitle="ราคาตลาดจริงแสดงผลผ่านวิดเจ็ต TradingView — และเปิดกราฟจริงที่ติดตั้งอินดิเคเตอร์ TradePulse ได้ในคลิกเดียว"
        />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-full border border-border bg-surface p-1"
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

          <Button
            href={tradingView.chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            เปิดกราฟจริงบน TradingView ↗
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border card-surface p-1.5">
          <div className="h-[420px] w-full sm:h-[500px]">
            <TradingViewChart symbol={tradingView.symbol} interval={activeInterval} />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          ข้อมูลราคาเป็นของตลาดจริงจาก TradingView • เส้นอินดิเคเตอร์ TradePulse (Entry / TP / SL / Zone)
          จะแสดงบนกราฟจริงหลังได้รับสิทธิ์ใช้งาน • TradePulse ไม่มีส่วนเกี่ยวข้องกับ TradingView
        </p>
      </div>
    </section>
  );
}
