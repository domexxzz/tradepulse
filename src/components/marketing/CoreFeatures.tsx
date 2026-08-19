import { SectionHeading } from "@/components/ui/SectionHeading";
import { coreFeatures } from "@/config/features";
import { Icon } from "@/components/common/Icon";
import { Check } from "lucide-react";

export function CoreFeatures() {
  return (
    <section id="features" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="ฟีเจอร์หลัก"
          title="เครื่องมือสำคัญที่ใช้บ่อยที่สุด"
          subtitle="โฟกัส 6 ฟีเจอร์ที่ช่วยให้คุณตัดสินใจได้เร็วและมีแผน"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((f) => (
            <div key={f.title} className="card-surface rounded-2xl p-6 transition-colors hover:border-brand/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon name={f.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
              <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{f.benefit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
