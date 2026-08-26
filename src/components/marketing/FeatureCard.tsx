import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Feature } from "@/config/features";
import { Icon } from "@/components/common/Icon";

/**
 * การ์ดฟีเจอร์: ช่องภาพ (screenshot จริงจาก TradingView หรือ fallback แบรนด์)
 * + ชื่อฟีเจอร์ + คำอธิบาย + วิธีใช้
 * ใส่ screenshot จริงได้โดยกำหนด feature.image = "/images/features/xxx.png"
 */
export function FeatureCard({ feature }: { feature: Feature }) {
  const { title, slug, desc, howto, icon, image } = feature;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/60 transition-colors hover:border-brand/40">
      {/* ช่องภาพ */}
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border">
        {image ? (
          <Image
            src={image}
            alt={`ตัวอย่างการใช้งาน ${title}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <FeatureMedia icon={icon} />
        )}
      </div>

      {/* เนื้อหา */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
          <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">{desc}</p>

        <div className="mt-4 rounded-xl border border-border bg-background/40 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">วิธีใช้</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">{howto}</p>
        </div>

        <Link
          href={`/features/${slug}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          อ่านรายละเอียด
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

/** พื้นที่ภาพแบบแบรนด์ (ใช้เมื่อยังไม่มี screenshot จริง) — ไม่ใช่ภาพปลอมของกราฟ */
function FeatureMedia({ icon }: { icon: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand/12 via-surface to-background">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(120% 120% at 50% 40%, #000 40%, transparent 78%)",
        }}
        aria-hidden
      />
      <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-brand/25 bg-brand/10 text-brand shadow-[0_0_40px_-8px_var(--brand)]">
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <span className="absolute bottom-2.5 right-3 text-[10px] font-medium uppercase tracking-widest text-muted/70">
        QVX
      </span>
    </div>
  );
}
