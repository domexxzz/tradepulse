import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { steps } from "@/config/features";

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface section">
      <div className="container-x">
        <SectionHeading
          eyebrow="เริ่มต้นการใช้งาน QVX"
          title="เปิดใช้งาน QVX Indicator"
          subtitle="หลังจากสมัครสมาชิกและผ่านเงื่อนไขการใช้งานแล้ว ทำตามขั้นตอนด้านล่างเพื่อรับสิทธิ์และเปิดใช้งาน QVX Indicator"
        />

        {/* เรียงลงมาทีละขั้นเต็มความกว้าง ไม่จัดเป็นกริดสองช่องเหมือนชุดเดิม
            เพราะภาพชุดนี้มีตัวหนังสือไทยอยู่ในภาพ พอย่อลงครึ่งคอลัมน์แล้วอ่านไม่ออก */}
        <ol className="mx-auto mt-12 max-w-4xl space-y-14">
          {steps.map((s) => (
            <li key={s.no}>
              <div className="flex items-start gap-4">
                <span className="tnum mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display font-bold text-brand">
                  {s.no}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold">{s.title}</h3>
                  {/* คำอธิบายอยู่นอกภาพ เพราะตัวหนังสือในภาพ screen reader อ่านไม่ได้
                      และเป็นข้อความที่ลูกค้าต้องอ่านก่อนดูภาพ ไม่ใช่คำบรรยายทีหลัง */}
                  <p className="mt-2 leading-relaxed text-muted">{s.desc}</p>
                </div>
              </div>

              <figure className="card-frame card-frame-soft mt-5 overflow-hidden rounded-2xl">
                <Image
                  src={s.image}
                  alt={s.imageAlt}
                  width={1920}
                  height={1080}
                  sizes="(min-width: 960px) 896px, 100vw"
                  className="block h-auto w-full"
                />
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
