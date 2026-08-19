"use client";
import { useEffect, useId, useRef } from "react";

/** โหลด tv.js ครั้งเดียว (ใช้ constructor แทน embed script เพื่อเลี่ยง console error) */
let tvPromise: Promise<void> | null = null;
function loadTradingView(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { TradingView?: unknown }).TradingView) return Promise.resolve();
  if (!tvPromise) {
    tvPromise = new Promise<void>((resolve) => {
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }
  return tvPromise;
}

export function TradingViewChart({
  symbol = "OANDA:XAUUSD",
  interval = "60",
}: {
  symbol?: string;
  interval?: string;
}) {
  const rawId = useId();
  const id = "tv_" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadTradingView().then(() => {
      const TV = (window as unknown as { TradingView?: { widget: new (o: object) => void } }).TradingView;
      if (cancelled || !TV || !ref.current) return;
      ref.current.innerHTML = "";
      new TV.widget({
        container_id: id,
        symbol,
        interval,
        autosize: true,
        theme: "dark",
        style: "1",
        locale: "th_TH",
        timezone: "Asia/Bangkok",
        hide_side_toolbar: false,
        allow_symbol_change: true,
        withdateranges: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, symbol, interval]);

  return <div id={id} ref={ref} className="h-full w-full" />;
}
