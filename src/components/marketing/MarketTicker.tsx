import { TradingViewTicker } from "./TradingViewTicker";

export function MarketTicker() {
  return (
    <div aria-label="ราคาสินทรัพย์แบบเรียลไทม์" className="border-y border-border bg-surface">
      <TradingViewTicker />
    </div>
  );
}
