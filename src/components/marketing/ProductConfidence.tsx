import { Check, Minus, Sparkles } from "lucide-react";

const comparison = [
  ["เห็นโครงสร้างและโซนในบริบทเดียว", "ต้องประกอบเอง", "รวมในหน้าชาร์ต"],
  ["ชุดตั้งค่าตามสไตล์การใช้งาน", "ตั้งค่าเริ่มจากศูนย์", "มี 3 ชุดพร้อมคู่มือ"],
  ["การแจ้งเตือนนอก TradingView", "ขึ้นกับเครื่องมือ", "Telegram สำหรับสมาชิก"],
  ["คู่มือและขั้นตอนเปิดสิทธิ์", "แตกต่างกันไป", "รวมในบัญชีผู้ใช้"],
] as const;

const evolution = [
  ["01", "อ่านโครงสร้าง", "BOS, CHoCH และ HH / HL / LH / LL เป็นฐานของการอ่านตลาด"],
  ["02", "เพิ่มบริบทของโซน", "เชื่อม FVG, Order Block, Demand/Supply และ Liquidity เข้าด้วยกัน"],
  ["03", "แยกชุดตามสไตล์", "SMC, Gold trend-following และ ICT session-based ใช้ภาพกราฟคนละมุม"],
  ["04", "เชื่อมประสบการณ์สมาชิก", "คู่มือ หน้าบัญชี และ Telegram ช่วยให้เริ่มใช้งานต่อได้หลังซื้อ"],
] as const;

export function ProductConfidence() {
  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <article className="scroll-reveal overflow-hidden rounded-3xl border border-border-strong bg-surface">
        <div className="p-6 sm:p-7"><p className="eyebrow">เทียบวิธีใช้งาน</p><h3 className="display mt-2 text-2xl">จากหลายชิ้นส่วน สู่ workflow เดียว</h3><p className="mt-3 text-sm text-muted">เปรียบเทียบลักษณะการใช้งานทั่วไป ไม่ใช่การกล่าวอ้างเหนือผลิตภัณฑ์ใดโดยเฉพาะ</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead><tr className="border-y border-border bg-background/50 text-xs text-muted"><th className="px-6 py-3 font-medium">สิ่งที่ต้องทำ</th><th className="px-4 py-3 font-medium">เครื่องมือแยกส่วน</th><th className="px-4 py-3 font-medium text-brand">QVX workflow</th></tr></thead><tbody>{comparison.map(([topic, generic, qvx]) => <tr key={topic} className="border-b border-border last:border-0"><th className="px-6 py-4 font-medium">{topic}</th><td className="px-4 py-4 text-muted"><span className="flex items-center gap-2"><Minus className="h-3.5 w-3.5" aria-hidden />{generic}</span></td><td className="px-4 py-4"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand" aria-hidden />{qvx}</span></td></tr>)}</tbody></table></div>
      </article>

      <article className="scroll-reveal rounded-3xl border border-border-strong bg-surface p-6 sm:p-7">
        <p className="eyebrow">Product evolution</p><h3 className="display mt-2 text-2xl">ระบบถูกต่อยอดเป็นลำดับ ไม่ใช่กองฟีเจอร์</h3>
        <ol className="mt-7 space-y-5">{evolution.map(([number, title, detail], index) => <li key={number} className="relative grid grid-cols-[2.5rem_1fr] gap-3"><div className="relative"><span className="tnum grid h-9 w-9 place-items-center rounded-full border border-brand/30 bg-brand/5 text-xs font-semibold text-brand">{number}</span>{index < evolution.length - 1 ? <span className="absolute left-[17px] top-10 h-[calc(100%+8px)] w-px bg-border-strong" aria-hidden /> : null}</div><div><h4 className="flex items-center gap-2 font-semibold">{title}{index === evolution.length - 1 ? <Sparkles className="h-4 w-4 text-brand" aria-hidden /> : null}</h4><p className="mt-1.5 text-sm leading-6 text-muted">{detail}</p></div></li>)}</ol>
      </article>
    </div>
  );
}
