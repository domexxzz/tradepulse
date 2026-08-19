import { SectionHeading } from "@/components/ui/SectionHeading";
import { problems } from "@/config/features";
import { ArrowRight } from "lucide-react";

export function ProblemSolution() {
  return (
    <section className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="ทำไมต้อง TradePulse"
          title="จากการดูกราฟหลายหน้าจอ สู่แผนการเทรดที่ชัดเจนขึ้น"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {problems.map((p) => (
            <div key={p.problem} className="card-surface rounded-2xl p-6">
              <div className="text-sm font-semibold text-down">ปัญหา</div>
              <p className="mt-1.5 font-medium">{p.problem}</p>
              <div className="my-4 flex items-center gap-2 text-brand">
                <ArrowRight className="h-4 w-4" />
                <span className="text-sm font-semibold">TradePulse ช่วยได้</span>
              </div>
              <p className="text-sm text-muted">{p.solution}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
