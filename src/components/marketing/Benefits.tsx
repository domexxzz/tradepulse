import { SectionHeading } from "@/components/ui/SectionHeading";
import { benefits } from "@/config/features";
import { Check } from "lucide-react";

export function Benefits() {
  return (
    <section id="benefits" className="py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="สิ่งที่คุณจะได้รับ"
          title="ทุกอย่างที่ช่วยให้เทรดอย่างมีระบบ"
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b} className="card-frame flex items-start gap-3 rounded-xl p-5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
