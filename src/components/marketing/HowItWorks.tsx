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
        <ol className="mx-auto mt-12 grid max-w-6xl gap-8 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.no} className="card-frame card-frame-soft overflow-hidden rounded-2xl">
              <Image
                src={s.image}
                alt={s.imageAlt}
                width={1600}
                height={1000}
                sizes="(min-width: 640px) 560px, 100vw"
                className="block h-auto w-full"
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
