import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { allFeatures, getFeatureBySlug } from "@/config/features";
import { plansFor } from "@/config/plans";
import { getPromoState } from "@/lib/pricing";
import { formatTHB } from "@/lib/utils";
import { Icon } from "@/components/common/Icon";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowRight, ChevronRight } from "lucide-react";

/** สร้างทุกหน้าไว้ล่วงหน้าตอน build — เนื้อหามาจากไฟล์ config ไม่เปลี่ยนระหว่างรัน */
// ราคาบนหน้านี้ต้องตามโปรที่เหลืออยู่จริง จึงรีเฟรชด้วยจังหวะเดียวกับหน้าแรก
export const revalidate = 300;

export function generateStaticParams() {
  return allFeatures.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) return { title: "ไม่พบฟีเจอร์นี้" };

  const description = `${feature.desc} — ฟีเจอร์ใน ${site.name} อินดิเคเตอร์วิเคราะห์ XAUUSD บน TradingView`;

  return {
    title: feature.title,
    description,
    alternates: { canonical: `/features/${feature.slug}` },
    openGraph: {
      title: `${feature.title} | ${site.name}`,
      description,
      url: `${site.url}/features/${feature.slug}`,
      type: "article",
    },
  };
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) notFound();

  // ฟีเจอร์กลุ่มเดียวกันอีก 3 ตัว ไว้ให้อ่านต่อ (ช่วยทั้งคนอ่านและการเก็บลิงก์ของ Google)
  const related = allFeatures
    .filter((f) => f.group === feature.group && f.slug !== feature.slug)
    .slice(0, 3);

  const cheapest = Math.min(...plansFor((await getPromoState()).monthlyTHB).map((p) => p.priceTHB));

  return (
    <main className="container-x max-w-3xl py-14">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "หน้าแรก", item: site.url },
              { "@type": "ListItem", position: 2, name: "ฟีเจอร์", item: `${site.url}/features` },
              {
                "@type": "ListItem",
                position: 3,
                name: feature.title,
                item: `${site.url}/features/${feature.slug}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: feature.title,
            description: feature.desc,
            articleSection: feature.groupLabel,
            isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
          },
        ]}
      />

      <nav aria-label="เส้นทางหน้า" className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/" className="hover:text-foreground">หน้าแรก</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/features" className="hover:text-foreground">ฟีเจอร์</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{feature.title}</span>
      </nav>

      <div className="mt-6 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-brand/25 bg-brand/10 text-brand">
          <Icon name={feature.icon} className="h-7 w-7" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            {feature.groupLabel}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold sm:text-4xl">{feature.title}</h1>
        </div>
      </div>

      <p className="mt-6 text-lg leading-relaxed text-muted">{feature.desc}</p>

      {feature.image && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-border">
          <Image
            src={feature.image}
            alt={`ตัวอย่างการใช้งาน ${feature.title} บนกราฟจริง`}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <section className="card-frame mt-8 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">วิธีใช้งาน</h2>
        <p className="mt-3 leading-relaxed text-foreground/85">{feature.howto}</p>
      </section>

      <p className="mt-6 rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-muted">
        เครื่องมือนี้ใช้ช่วยวิเคราะห์และวางแผนเท่านั้น ไม่ใช่คำแนะนำการลงทุน
        และไม่รับประกันผลตอบแทน การตัดสินใจเทรดและความเสี่ยงทั้งหมดเป็นของผู้ใช้
      </p>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold">ฟีเจอร์ที่ใช้คู่กันได้</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((f) => (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className="group card-frame card-frame-link rounded-2xl p-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon name={f.icon} className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-3 text-sm font-semibold leading-tight">{f.title}</h3>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand">
                  อ่านต่อ
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 rounded-2xl border border-brand/30 bg-brand/5 p-7 text-center">
        <h2 className="font-display text-xl font-bold">ใช้ฟีเจอร์นี้บนกราฟของคุณ</h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm text-muted">
          ทุกแพ็กเกจได้เครื่องมือครบทุกตัว เริ่มต้น {formatTHB(cheapest)}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/#pricing"
            className="inline-flex h-11 items-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
          >
            ดูราคาแพ็กเกจ
          </Link>
          <Link
            href="/features"
            className="inline-flex h-11 items-center rounded-full border border-brand/40 px-7 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            ดูฟีเจอร์ทั้งหมด
          </Link>
        </div>
      </section>
    </main>
  );
}
