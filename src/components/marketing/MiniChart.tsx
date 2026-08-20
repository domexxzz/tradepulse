/** สปาร์คไลน์เล็กสำหรับการ์ดกราฟ (SVG, ไม่มีข้อมูลจริง) */
const W = 240;
const H = 96;

export function MiniChart({ data, up = true }: { data: number[]; up?: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = W / (data.length - 1);
  const pts = data.map((d, i) => [i * stepX, H - 8 - ((d - min) / span) * (H - 20)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const color = up ? "#65e62c" : "#d85b5b";
  const gid = `g_${up ? "u" : "d"}_${data[0]}_${data.length}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
