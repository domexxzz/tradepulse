import { SectionHeading } from "@/components/ui/SectionHeading";
import { faqs } from "@/config/features";
import { ChevronDown } from "lucide-react";

export function FAQ() {
  return (
    <section id="faq" className="border-y border-border bg-surface section">
      <div className="container-x">
        <SectionHeading eyebrow="คำถามพบบ่อย" title="คำถามที่พบบ่อย" />
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group card-surface rounded-xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                <span>{f.q}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
