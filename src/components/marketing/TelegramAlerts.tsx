import { Button } from "@/components/ui/Button";
import { Check, Lock } from "lucide-react";

const points = [
  "สัญญาณ Buy / Sell พร้อม Entry, TP และ SL ครบในข้อความเดียว",
  "แยกห้องตาม Timeframe — M5 / M15 / M30 / 1H",
  "ส่งทันทีที่อินดิเคเตอร์ยิงสัญญาณ ไม่ต้องเฝ้าหน้าจอ",
  "ดูสัญญาณย้อนหลังในกลุ่มได้ทุกเมื่อ",
];

export function TelegramAlerts() {
  return (
    <section id="telegram" className="border-y border-border bg-surface section">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <Lock className="h-3.5 w-3.5" /> Telegram Alerts · เฉพาะสมาชิก
          </p>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">สัญญาณส่งเข้า Telegram แบบเรียลไทม์</h2>
          <p className="mt-3 max-w-xl text-muted">
            สมาชิกจะได้รับสิทธิ์เข้ากลุ่ม Telegram ที่เชื่อมสัญญาณจากอินดิเคเตอร์อัตโนมัติ —
            แยกห้องตามไทม์เฟรม รับจังหวะเข้าเทรดได้ทันทีทุกที่
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button href="#pricing" size="lg">สมัครเพื่อเข้ากลุ่ม Telegram</Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            🔒 เข้ากลุ่มได้เฉพาะสมาชิก — ลิงก์เข้ากลุ่มอยู่ในหน้าบัญชีของคุณทันทีหลังยืนยันการชำระเงิน
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-background p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-strong to-brand-deep font-display text-sm font-bold text-brand-ink">
                T
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">TradePulse Signals</div>
                <div className="text-[11px] text-muted">ห้อง M15 · เมื่อสักครู่</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-surface-2 p-4">
              <div className="text-sm font-bold text-up">🟢 BUY XAUUSD · M15</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>Entry: <b>4,300</b></div>
                <div>TP: <b className="text-up">4,340</b></div>
                <div>SL: <b className="text-down">4,285</b></div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-surface-2 p-4">
              <div className="text-sm font-bold text-down">🔴 SELL XAUUSD · 1H</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>Entry: <b>4,610</b></div>
                <div>TP: <b className="text-up">4,560</b></div>
                <div>SL: <b className="text-down">4,630</b></div>
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] text-muted">ตัวอย่างข้อความในกลุ่ม</div>
          </div>
        </div>
      </div>
    </section>
  );
}
