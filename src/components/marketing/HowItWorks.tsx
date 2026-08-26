import { SectionHeading } from "@/components/ui/SectionHeading";
import { steps } from "@/config/features";

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface section">
      <div className="container-x">
        <SectionHeading
          eyebrow="วิธีทำงาน"
          title="เริ่มใช้งานได้ใน 3 ขั้นตอน"
          subtitle="ออกแบบให้เข้าใจง่าย ใช้ได้ทั้งมือใหม่และผู้มีประสบการณ์"
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.no} className="card-soft rounded-2xl p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-background">
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
