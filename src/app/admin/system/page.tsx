import { getSystemStatus, type Health } from "@/lib/system-status";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw } from "lucide-react";

// สถานะเป็นของสด ห้ามแคช
export const dynamic = "force-dynamic";

const style: Record<Health, { cls: string; icon: typeof CheckCircle2; label: string }> = {
  ok: { cls: "text-up border-up/30 bg-up/10", icon: CheckCircle2, label: "ปกติ" },
  warn: { cls: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: AlertTriangle, label: "ยังไม่ครบ" },
  down: { cls: "text-down border-down/30 bg-down/10", icon: XCircle, label: "ติดต่อไม่ได้" },
  off: { cls: "text-muted border-border bg-surface-2", icon: MinusCircle, label: "ปิดอยู่" },
};

export default async function SystemStatusPage() {
  const rows = await getSystemStatus();
  const bad = rows.filter((r) => r.health === "down").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">สถานะระบบ</h1>
        <p className="mt-1 text-sm text-muted">
          ตรวจสด ๆ ทุกครั้งที่เปิดหน้านี้ — รีเฟรชหน้าเพื่อเช็คใหม่
          {bad > 0 && <span className="text-down"> · มี {bad} ระบบที่ติดต่อไม่ได้</span>}
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const s = style[r.health];
          return (
            <div key={r.name} className="card-surface flex flex-wrap items-start gap-4 rounded-2xl p-5">
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${s.cls}`}>
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </span>
              <div className="min-w-[220px] flex-1">
                <div className="font-medium">{r.name}</div>
                <p className="mt-0.5 text-sm text-muted">{r.detail}</p>
                {r.action && (
                  <p className="mt-1.5 text-xs text-brand">→ {r.action}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-surface-2/50 p-5 text-xs leading-relaxed text-muted">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> อ่านค่ายังไง
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <b className="text-down">ติดต่อไม่ได้</b> ที่บอท TradingView — ปกติแปลว่าเครื่องที่รันบอทปิดอยู่
            หรือบอทกำลังทำงานอยู่ (ระหว่างทำงานมันจะไม่ตอบ) คำขอที่เข้ามาช่วงนี้จะไปรอในคิวให้ทำมือ ไม่หาย
          </li>
          <li>
            <b className="text-muted">ปิดอยู่</b> = ยังไม่ได้ตั้งค่า ระบบจะข้ามส่วนนั้นไปโดยไม่พัง
            ยกเว้น <b className="text-down">งานประจำวัน</b> ที่ถ้าปิดอยู่ สมาชิกจะไม่มีวันหมดอายุ
          </li>
        </ul>
      </div>
    </div>
  );
}
