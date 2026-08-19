import { Button } from "@/components/ui/Button";
import { MockChart } from "./MockChart";
import { ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section id="top" className="hero-backdrop relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        {/* copy */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Indicator for XAUUSD on TradingView
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.15] sm:text-5xl">
            เห็นจังหวะทองคำชัดขึ้น
            <br />
            <span className="text-gradient-brand">วางแผนก่อนเข้าเทรด</span>
          </h1>
          <p className="mt-5 max-w-xl text-muted sm:text-lg">
            TradePulse รวม Trend, Buy/Sell Signal, Entry, TP/SL และ Risk Management ไว้ในระบบเดียว
            เพื่อช่วยให้คุณตัดสินใจอย่างมีแผนมากขึ้น
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="#demo" size="lg">ดู Demo การใช้งาน</Button>
            <Button href="#pricing" variant="outline" size="lg">เริ่มต้น ฿990/เดือน</Button>
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            ไม่ใช่สัญญาณการันตีกำไร • ผู้ใช้ต้องตัดสินใจและบริหารความเสี่ยงด้วยตนเอง
          </p>
        </div>

        {/* visual */}
        <div className="relative">
          <div className="card-surface overflow-hidden rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">XAUUSD · ตัวอย่างสัญญาณ Buy</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                ภาพตัวอย่างการใช้งาน
              </span>
            </div>
            <div className="aspect-[16/10] w-full">
              <MockChart variant="buy" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
