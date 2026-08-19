/**
 * กราฟแท่งเทียนจำลอง (SVG) สำหรับอธิบายการทำงานของอินดิเคเตอร์
 * ไม่ใช่ข้อมูลเรียลไทม์ — ใช้ประกอบคำอธิบายเท่านั้น
 */
type Variant = "buy" | "sell";

const W = 640;
const H = 380;
const PAD_L = 16;
const PAD_R = 74;
const PAD_T = 20;
const PAD_B = 28;

// ชุดราคาปิดจำลอง (คล้าย XAUUSD)
const SERIES: Record<Variant, number[]> = {
  buy: [2402, 2400, 2405, 2403, 2408, 2406, 2411, 2415, 2412, 2418, 2416, 2421, 2426, 2423, 2429, 2433, 2431, 2436, 2434, 2439, 2441, 2438],
  sell: [2440, 2442, 2437, 2439, 2434, 2436, 2431, 2427, 2429, 2423, 2425, 2420, 2415, 2418, 2412, 2408, 2410, 2405, 2407, 2402, 2400, 2403],
};

function build(variant: Variant) {
  const closes = SERIES[variant];
  const min = Math.min(...closes) - 6;
  const max = Math.max(...closes) + 6;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i / (closes.length - 1)) * plotW;
  const y = (p: number) => PAD_T + (1 - (p - min) / (max - min)) * plotH;
  const step = plotW / closes.length;

  const candles = closes.map((c, i) => {
    const prev = i === 0 ? c : closes[i - 1];
    const up = c >= prev;
    const bodyTop = up ? c : prev;
    const bodyBot = up ? prev : c;
    const wickH = (up ? c : prev) + 3;
    const wickL = (up ? prev : c) - 3;
    return { i, up, x: x(i), yOpen: y(bodyBot), yClose: y(bodyTop), yHigh: y(wickH), yLow: y(wickL), w: step * 0.55 };
  });

  // จุดสัญญาณ (ก่อน 6 แท่งสุดท้าย)
  const sigIndex = closes.length - 6;
  const entry = closes[sigIndex];
  const tp = variant === "buy" ? entry + 20 : entry - 20;
  const sl = variant === "buy" ? entry - 10 : entry + 10;

  return { candles, x, y, entry, tp, sl, sigIndex, min, max };
}

export function MockChart({ variant = "buy" }: { variant?: Variant }) {
  const { candles, x, y, entry, tp, sl, sigIndex } = build(variant);
  const brand = "#65e62c";
  const down = "#d85b5b";
  const line = (p: number) => y(p);

  const sigX = x(sigIndex);
  const sigY = variant === "buy" ? line(sl) + 16 : line(sl) - 16;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`ภาพตัวอย่างการใช้งาน: สัญญาณ ${variant === "buy" ? "Buy" : "Sell"} พร้อมจุด Entry, TP และ SL บนกราฟทองคำ`}
    >
      {/* grid */}
      {[0, 1, 2, 3, 4].map((g) => (
        <line key={g} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + (g * (H - PAD_T - PAD_B)) / 4} y2={PAD_T + (g * (H - PAD_T - PAD_B)) / 4} stroke="#1e2c22" strokeWidth="1" />
      ))}

      {/* trend band */}
      <rect
        x={PAD_L}
        y={variant === "buy" ? PAD_T : line(entry)}
        width={W - PAD_L - PAD_R}
        height={variant === "buy" ? line(entry) - PAD_T : H - PAD_B - line(entry)}
        fill={variant === "buy" ? "rgba(101,230,44,0.06)" : "rgba(216,91,91,0.06)"}
      />

      {/* candles */}
      {candles.map((c) => (
        <g key={c.i}>
          <line x1={c.x} x2={c.x} y1={c.yHigh} y2={c.yLow} stroke={c.up ? brand : down} strokeWidth="1.2" />
          <rect
            x={c.x - c.w / 2}
            y={c.yClose}
            width={c.w}
            height={Math.max(2, c.yOpen - c.yClose)}
            rx="1"
            fill={c.up ? brand : down}
            opacity={0.92}
          />
        </g>
      ))}

      {/* TP / Entry / SL lines */}
      {[
        { p: tp, label: "TP", color: brand },
        { p: entry, label: "Entry", color: "#f3f7f1" },
        { p: sl, label: "SL", color: down },
      ].map((lv) => (
        <g key={lv.label}>
          <line x1={PAD_L} x2={W - PAD_R} y1={line(lv.p)} y2={line(lv.p)} stroke={lv.color} strokeWidth="1.4" strokeDasharray={lv.label === "Entry" ? "1 0" : "5 4"} opacity={lv.label === "Entry" ? 0.9 : 0.85} />
          <rect x={W - PAD_R + 2} y={line(lv.p) - 10} width={PAD_R - 4} height="20" rx="4" fill={lv.color} />
          <text x={W - PAD_R / 2} y={line(lv.p) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#08100b">
            {lv.label} {Math.round(lv.p)}
          </text>
        </g>
      ))}

      {/* signal marker */}
      <g>
        {variant === "buy" ? (
          <path d={`M ${sigX} ${sigY - 10} l 6 10 l -12 0 z`} fill={brand} />
        ) : (
          <path d={`M ${sigX} ${sigY + 10} l 6 -10 l -12 0 z`} fill={down} />
        )}
        <rect x={sigX - 20} y={variant === "buy" ? sigY + 4 : sigY - 24} width="40" height="18" rx="4" fill={variant === "buy" ? brand : down} />
        <text x={sigX} y={variant === "buy" ? sigY + 17 : sigY - 11} textAnchor="middle" fontSize="11" fontWeight="800" fill="#08100b">
          {variant === "buy" ? "BUY" : "SELL"}
        </text>
      </g>

      {/* watermark */}
      <text x={PAD_L + 4} y={H - 8} fontSize="10" fill="#91a095" opacity="0.8">
        ภาพตัวอย่างการใช้งาน • ไม่ใช่ข้อมูลเรียลไทม์
      </text>
    </svg>
  );
}
