import { SectionHeading } from "@/components/ui/SectionHeading";
import { advancedTools, advancedIntro } from "@/config/features";
import { FeatureCard } from "@/components/marketing/FeatureCard";

/** Part 2 — เครื่องมือเสริม/ขั้นสูง (9 รายการ) ต่อเนื่องจากฟีเจอร์หลัก */
export function AllFeatures() {
  return (
    <section id="advanced-tools" className="section-md">
      <div className="container-x">
        <SectionHeading
          eyebrow="เครื่องมือขั้นสูง"
          title="ปรับมุมมองและวิเคราะห์ได้ลึกขึ้น"
          subtitle={advancedIntro}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {advancedTools.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
