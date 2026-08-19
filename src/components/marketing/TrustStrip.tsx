import { trustItems } from "@/config/features";
import { Icon } from "@/components/common/Icon";

export function TrustStrip() {
  return (
    <section aria-label="จุดเด่นของระบบ" className="border-y border-border bg-surface">
      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-5 py-6 lg:grid-cols-4">
        {trustItems.map((t) => (
          <div key={t.label} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon name={t.icon} className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
