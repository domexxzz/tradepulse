"use client";
import { useEffect, useRef } from "react";

/** Ticker tape (embed script) — inject ครั้งเดียว */
export function TradingViewTicker() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !ref.current) return;
    done.current = true;

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    ref.current.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "OANDA:XAUUSD", title: "ทองคำ" },
        { proName: "FX:EURUSD", title: "EUR/USD" },
        { proName: "FX:GBPUSD", title: "GBP/USD" },
        { proName: "OANDA:USDJPY", title: "USD/JPY" },
        { proName: "BINANCE:BTCUSDT", title: "BTC/USDT" },
        { proName: "BINANCE:ETHUSDT", title: "ETH/USDT" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "th_TH",
    });
    ref.current.appendChild(script);
  }, []);

  return <div ref={ref} className="tradingview-widget-container" style={{ minHeight: 46 }} />;
}
