import { moreFeatures } from "@/config/features";
import { Icon } from "@/components/common/Icon";
import { ChevronDown } from "lucide-react";

export function AllFeatures() {
  return (
    <section className="pb-4">
      <div className="container-x">
        <details className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="mx-auto flex w-fit cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand/40">
            ดูฟีเจอร์ทั้งหมด ({moreFeatures.length}+ เครื่องมือ)
            <ChevronDown className="h-4 w-4 text-brand transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moreFeatures.map((f) => (
              <div key={f.title} className="card-soft rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon name={f.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                </div>
                <p className="mt-2.5 text-sm text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
