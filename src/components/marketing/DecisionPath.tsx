import { BellRing, ChartNoAxesCombined, CircleUserRound, CreditCard, KeyRound, Layers3, ScanSearch, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const stories = [
  { problem: "ไม่รู้ว่าตลาดเปลี่ยนฝั่งเมื่อไร", answer: "อ่าน BOS / CHoCH และโครงสร้าง HH · HL · LH · LL บนกราฟ", Icon: ChartNoAxesCombined },
  { problem: "กลัวเข้าไล่ราคากลางทาง", answer: "รอ FVG, Order Block และ Demand/Supply ในจุดที่มีบริบท", Icon: Layers3 },
  { problem: "มองไม่เห็นจุดล่าสภาพคล่อง", answer: "ใช้ Liquidity Pool และ Sweep ประกอบการรอสัญญาณยืนยัน", Icon: ScanSearch },
  { problem: "ไม่มีเวลาเฝ้าหน้าจอตลอด", answer: "รับการแจ้งเตือนจากระบบผ่าน Telegram แยกตามไทม์เฟรม", Icon: BellRing },
] as const;

const steps = [
  { label: "เลือกแพ็กเกจ", detail: "เลือกระยะเวลาที่เหมาะกับคุณ", Icon: CreditCard },
  { label: "แจ้ง Username", detail: "กรอก TradingView Username ในหน้าบัญชี", Icon: CircleUserRound },
  { label: "เปิดสิทธิ์", detail: "ทีมงานตรวจสอบและเปิดสิทธิ์โดยปกติภายใน 24 ชั่วโมง", Icon: KeyRound },
  { label: "เริ่มใช้งาน", detail: "เพิ่ม Invite-only Script และรับลิงก์ Telegram", Icon: ShieldCheck },
] as const;

export function DecisionPath() {
  return (
    <section id="how" className="border-y border-border bg-surface section">
      <div className="container-x">
        <SectionHeading align="center" eyebrow="จากปัญหา สู่เครื่องมือ" title="ไม่ต้องจำศัพท์ทั้งหมด แค่รู้ว่ากำลังแก้ปัญหาอะไร" subtitle="QVX รวมเครื่องมือที่เกี่ยวข้องไว้ในบริบทเดียว เพื่อช่วยให้การอ่านกราฟเป็นขั้นตอนมากขึ้น" />
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {stories.map(({ problem, answer, Icon }) => (
            <article key={problem} className="group rounded-2xl border border-border bg-background/45 p-5 transition-colors hover:border-brand/25 hover:bg-brand/5 sm:p-6">
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/5 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="text-xs font-medium text-faint">ปัญหาที่เจอบ่อย</p>
                  <h3 className="mt-1 font-semibold">{problem}</h3>
                  <p className="mt-3 border-l border-brand/40 pl-3 text-sm leading-6 text-muted">{answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-border-strong bg-background/55 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="eyebrow">หลังชำระเงิน</p><h3 className="display mt-2 text-2xl sm:text-3xl">เริ่มใช้ได้ใน 4 ขั้นตอน</h3></div>
            <p className="max-w-md text-sm text-muted">สิทธิ์เริ่มนับเมื่อทีมงานอนุมัติ ไม่เสียเวลาสมาชิกระหว่างรอตรวจสอบ</p>
          </div>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ label, detail, Icon }, index) => (
              <li key={label} className="relative rounded-2xl border border-border bg-surface p-5">
                <span className="tnum absolute right-4 top-3 text-3xl font-bold text-brand/15">0{index + 1}</span>
                <Icon className="h-5 w-5 text-brand" aria-hidden />
                <h4 className="mt-5 font-semibold">{label}</h4>
                <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
