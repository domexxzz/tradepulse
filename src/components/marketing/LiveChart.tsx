import { SectionHeading } from "@/components/ui/SectionHeading";
import { TradingViewChart } from "./TradingViewChart";

export function LiveChart() {
  return (
    <section id="chart" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="ราคาเรียลไทม์"
          title="กราฟทองคำ XAUUSD แบบเรียลไทม์"
          subtitle="ราคาตลาดจริงแสดงผลผ่านวิดเจ็ต TradingView — ใช้ประกอบการวิเคราะห์ของคุณ"
        />
        <div className="mt-8 overflow-hidden rounded-2xl border border-border card-surface p-1.5">
          <div className="h-[420px] w-full sm:h-[500px]">
            <TradingViewChart symbol="OANDA:XAUUSD" interval="60" />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          ข้อมูลราคาเป็นของตลาดจริงจาก TradingView • TradePulse ไม่มีส่วนเกี่ยวข้องกับ TradingView
        </p>
      </div>
    </section>
  );
}
