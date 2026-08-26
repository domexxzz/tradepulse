import { SectionHeading } from "@/components/ui/SectionHeading";
import { coreFeatures, coreIntro } from "@/config/features";
import { FeatureCard } from "@/components/marketing/FeatureCard";

export function CoreFeatures() {
  return (
    <section id="features" className="section">
      <div className="container-x">
        <SectionHeading
          eyebrow="ฟีเจอร์หลัก"
          title="เครื่องมืออ่านโครงสร้างราคาและสัญญาณ"
          subtitle={coreIntro}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
