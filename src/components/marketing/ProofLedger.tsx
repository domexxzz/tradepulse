import Link from "next/link";
import { ArrowUpRight, BookOpen, RotateCcw, Users, XCircle } from "lucide-react";
import { tradingView, discordInviteUrl } from "@/config/site";

/**
 * "ตรวจเองได้ / เราไม่ทำอะไรบ้าง" — เติมช่องหลักฐานที่ว่างอยู่
 *
 * ที่มา: BacktestStats คืน null เพราะ stats.published = false (ยังไม่มีตัวเลขจริง)
 * และ Reviews ก็คืน null เพราะยังไม่มีรีวิวที่แอดมินอนุมัติในฐานข้อมูล
 * ผลคือชั้น "หลักฐาน" ของหน้าแรกเรนเดอร์ออกมาเป็นความว่างเปล่าทั้งชั้น
 *
 * ทางแก้ที่ห้ามทำคือกรอกตัวเลขหรือรีวิวปลอมลงไป — เว็บนี้ประกาศไว้เองว่ารีวิว
 * มาจากสมาชิกจริง และ config/stats.ts เขียนกำกับไว้ว่าห้ามโชว์ตัวเลขปลอม
 * (ยังไม่นับว่าโฆษณาเกินจริงผิด พ.ร.บ.คุ้มครองผู้บริโภคด้วย)
 *
 * จึงเติมด้วยของที่ "มีจริงและกดตรวจได้เดี๋ยวนี้" แทน แล้วประกาศตรง ๆ ว่าอะไร
 * ที่ยังไม่เผยแพร่ ในตลาดที่เต็มไปด้วยอินดิเคเตอร์อวดผลกำไรปลอม
 * การบอกว่า "เราจะไม่โชว์อะไร" ให้น้ำหนักความน่าเชื่อถือมากกว่าตัวเลขสวย ๆ
 *
 * เมื่อไหร่ที่มีตัวเลข backtest จริง (ตั้ง published = true ใน config/stats.ts)
 * หรือมีรีวิวที่อนุมัติแล้ว สอง section นั้นจะโผล่ขึ้นมาเองข้าง ๆ อันนี้
 */
export function ProofLedger() {
  const checkable = [
    {
      Icon: ArrowUpRight,
      title: "เปิดกราฟบน TradingView",
      detail: "เลย์เอาต์เดียวกับที่ใช้ทำภาพทั้งหมดในหน้านี้ กดเข้าไปดูได้เลย",
      href: tradingView.chartUrl,
      external: true,
    },
    {
      Icon: BookOpen,
      title: "อ่านค่าตั้งทั้ง 3 ชุดก่อนจ่ายเงิน",
      detail: "คู่มือเปิดสาธารณะ ไม่ได้ซ่อนไว้หลังการสมัคร",
      href: "/guide",
    },
    {
      Icon: RotateCcw,
      title: "สัญญาณยึดแท่งที่ปิดแล้ว",
      detail: "ออกแบบให้ไม่ Repaint — เกิดสัญญาณแล้วใช้อ้างอิงย้อนหลังได้",
      href: "/#faq",
    },
    {
      // แทนช่อง "คืนเงิน 7 วัน" ที่ถอดออกไป — ต้องมี 4 ช่องพอดี ไม่งั้นกริด 2 คอลัมน์
      // จะเหลือช่องว่างโชว์สีเส้นขอบเป็นก้อนเทา ๆ ค้างอยู่
      // อันนี้ตรวจได้จริงเหมือนกัน: เข้าไปดูชุมชนก่อนจ่ายเงินได้เลย ไม่ต้องเป็นสมาชิก
      Icon: Users,
      title: "เข้าดูชุมชนก่อนได้ ไม่ต้องจ่าย",
      detail: "เซิร์ฟเวอร์ Discord เปิดให้ทุกคน เข้าไปดูบรรยากาศก่อนตัดสินใจ",
      href: discordInviteUrl,
      external: true,
    },
  ];

  const wontDo = [
    "ไม่โชว์ผล backtest จนกว่าจะมีตัวเลขจริงจาก Strategy Tester",
    "ไม่มีรีวิวปลอม — ขึ้นเฉพาะรีวิวจากสมาชิกที่จ่ายเงินจริง",
    "ไม่รับประกันกำไร และไม่เรียกภาพ Bar Replay ว่าผลการเทรดสด",
  ];

  return (
    <section aria-labelledby="proof-ledger-heading" className="section-md">
      <div className="container-x">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3.5">ก่อนเชื่อใคร ตรวจก่อน</p>
          {/* เรียงคำให้จุดตัดตกที่ช่องว่างที่เราวางเอง — ดูหมายเหตุที่ .display ใน globals.css
              ("ทุกอย่างที่อ้างในหน้านี้ กดตรวจเองได้" โดนตัดเป็น "...ในหน้า / นี้ กด...") */}
          <h2 id="proof-ledger-heading" className="display text-[length:var(--display-md)]">
            ทุกอย่างที่อ้างไว้ กดตรวจเองได้
          </h2>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          {/* ---------- ตรวจได้ตอนนี้ ---------- */}
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {checkable.map(({ Icon, title, detail, href, external }) => (
              <li key={title} className="bg-surface">
                <Link
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full flex-col gap-1.5 p-5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span className="text-sm font-semibold group-hover:text-brand">{title}</span>
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted">{detail}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* ---------- สิ่งที่เราไม่ทำ ---------- */}
          <div className="lg:border-l lg:border-border lg:pl-12">
            <h3 className="font-display text-lg font-semibold">สิ่งที่เราจะไม่ทำ</h3>
            <p className="mt-2 text-sm text-muted">
              ข้อจำกัดที่ตั้งไว้กับตัวเอง สำคัญพอ ๆ กับสิ่งที่เครื่องมือทำได้
            </p>
            <ul className="mt-5 space-y-3.5">
              {wontDo.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-down" aria-hidden />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
