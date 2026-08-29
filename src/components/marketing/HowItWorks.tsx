import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { steps } from "@/config/features";

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface section">
      <div className="container-x">
        {/* จำนวนขั้นตอนนับจาก steps ไม่ฮาร์ดโค้ด — ของเดิมเขียน "3 ขั้นตอน" ไว้ในหัวข้อ
            ถ้าเพิ่มหรือลดขั้นตอนใน config หัวข้อจะโกหกทันทีโดยไม่มีอะไรจับได้ */}
        <SectionHeading
          eyebrow="เริ่มต้นใช้งาน"
          title={`เริ่มใช้งานได้ใน ${steps.length} ขั้นตอน`}
          subtitle="ตั้งแต่สมัครจนเปิดกราฟใช้งานจริง ทำครั้งเดียวจบ"
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.no} className="card-frame card-frame-soft rounded-2xl p-6">
              <div className="overflow-hidden rounded-xl border border-border/70 bg-[#111A14]">
                <Image
                  src={s.image}
                  alt={s.imageAlt}
                  width={1600}
                  height={1000}
                  sizes="(min-width: 1024px) 240px, (min-width: 640px) 45vw, 100vw"
                  className="h-auto w-full"
                />
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-brand-ink">
                {s.no}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
