import { MiniChart } from "./MiniChart";

interface GCard {
  symbol: string;
  setup: string;
  up: boolean;
  change: string;
  data: number[];
}

const cards: GCard[] = [
  { symbol: "XAUUSD", setup: "Buy Setup", up: true, change: "+1.8%", data: [10, 11, 10.5, 12, 13, 12.5, 14, 15, 14.6, 16] },
  { symbol: "XAUUSD", setup: "Trend Zone", up: true, change: "+2.4%", data: [8, 8.5, 9, 8.8, 10, 11, 10.8, 12, 13, 13.4] },
  { symbol: "EURUSD", setup: "Sell Setup", up: false, change: "-1.1%", data: [16, 15.4, 15.6, 14, 13.5, 13.8, 12, 11.6, 12, 11] },
  { symbol: "BTCUSDT", setup: "Break Swing", up: true, change: "+3.2%", data: [9, 9.4, 9.1, 10, 11.2, 11, 12.4, 12, 13.5, 14.2] },
  { symbol: "XAUUSD", setup: "Entry / TP / SL", up: true, change: "+1.2%", data: [11, 11.3, 11, 11.6, 12, 11.8, 12.4, 13, 12.8, 13.2] },
  { symbol: "USDJPY", setup: "Market Structure", up: false, change: "-0.9%", data: [14, 13.6, 13.8, 13, 12.6, 12.9, 12, 12.3, 11.6, 11.4] },
  { symbol: "ETHUSDT", setup: "Multi-Timeframe", up: true, change: "+2.0%", data: [9, 9.6, 9.2, 10.2, 10, 11, 11.4, 11.2, 12, 12.6] },
];

function Card({ c }: { c: GCard }) {
  return (
    <div className="w-64 shrink-0 rounded-2xl border border-border bg-surface/80 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{c.symbol}</div>
          <div className="text-xs text-muted">{c.setup}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.up ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
          {c.change}
        </span>
      </div>
      <div className="mt-3 h-20">
        <MiniChart data={c.data} up={c.up} />
      </div>
      <div className="mt-2 text-[10px] text-muted">ตัวอย่างการแสดงผล</div>
    </div>
  );
}

export function GraphCarousel() {
  const loop = [...cards, ...cards];
  return (
    <section aria-label="ตัวอย่างการแสดงผลบนกราฟ" className="py-10">
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          {loop.map((c, i) => (
            <Card key={i} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
