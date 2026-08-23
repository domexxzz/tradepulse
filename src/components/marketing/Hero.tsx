import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { telegramCommunityUrl } from "@/config/site";
import { ShieldCheck, Zap, Send, LineChart } from "lucide-react";

const badges = [
  { icon: LineChart, label: "ใช้บน TradingView" },
  { icon: Zap, label: "สัญญาณเรียลไทม์" },
  { icon: Send, label: "แจ้งเตือนเข้า Telegram" },
];

export function Hero() {
  const tgHref = telegramCommunityUrl || "#telegram";
  return (
    <section id="top" className="hero-backdrop relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Smart Money Concept · XAUUSD · TradingView
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.12] sm:text-5xl">
            อ่านกราฟทองคำ
            <br />
            <span className="text-gradient-brand">ด้วยเทคนิคระดับโปร</span>
          </h1>
          <p className="mt-5 max-w-xl text-muted sm:text-lg">
            TradePulse รวม Trend, Buy/Sell Signal, Entry, TP/SL, โครงสร้างตลาด และ Risk Management
            ไว้ในระบบเดียว พร้อมส่งสัญญาณเข้า Telegram แบบเรียลไทม์ — ตัดสินใจอย่างมีแผน แม่นยำ เป็นระบบ
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="#pricing" size="lg">เริ่มใช้งาน</Button>
            <Button href={tgHref} variant="outline" size="lg">เข้ากลุ่ม Telegram</Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
            {badges.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
                <b.icon className="h-4 w-4 text-brand" />
                {b.label}
              </span>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            ไม่ใช่สัญญาณการันตีกำไร • ผู้ใช้ต้องตัดสินใจและบริหารความเสี่ยงด้วยตนเอง
          </p>
        </div>

        <div className="relative">
          <div className="card-surface overflow-hidden rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">XAUUSD · ตัวอย่างการใช้งาน</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                ภาพตัวอย่างการใช้งาน
              </span>
            </div>
            <Image
              src="/images/result-xauusd.png"
              alt="ตัวอย่างอินดิเคเตอร์ TradePulse บนกราฟทองคำ XAUUSD แสดงสัญญาณ Buy/Sell และโซนสำคัญ"
              width={1814}
              height={921}
              priority
              className="h-auto w-full rounded-xl border border-border"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
