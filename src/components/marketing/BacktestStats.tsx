import { SectionHeading } from "@/components/ui/SectionHeading";
import { backtest } from "@/config/stats";

export function BacktestStats() {
  if (!backtest.published) return null;
  const shown = backtest.metrics.filter((m) => m.value.trim() !== "");
  if (shown.length === 0) return null;

  const ctx = [backtest.context.symbol, backtest.context.timeframe, backtest.context.period]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="stats" className="section-md">
      <div className="container-x">
        <SectionHeading
          eyebrow="สถิติผลงาน"
          title="ผลทดสอบย้อนหลัง (Backtest)"
          subtitle={ctx ? `จาก TradingView Strategy Tester — ${ctx}` : "จาก TradingView Strategy Tester"}
        />
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
          {shown.map((m) => (
            <div key={m.label} className="card-frame rounded-2xl p-6 text-center">
              <div className={`font-display text-3xl font-bold ${m.good ? "text-gradient-brand" : ""}`}>
                {m.value}
                {m.suffix && <span className="text-xl">{m.suffix}</span>}
              </div>
              <div className="mt-1 text-sm text-muted">{m.label}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
          เป็นผลการทดสอบย้อนหลังจาก Strategy Tester ของ TradingView เพื่อประกอบการพิจารณาเท่านั้น
          • ผลในอดีตไม่ได้รับประกันผลในอนาคต • ไม่ใช่คำแนะนำการลงทุน การเทรดมีความเสี่ยง
        </p>
      </div>
    </section>
  );
}
