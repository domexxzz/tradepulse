import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { coreFeatures, advancedTools, coreIntro, advancedIntro, allFeatures } from "@/config/features";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { Icon } from "@/components/common/Icon";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowRight } from "lucide-react";

const title = "ฟีเจอร์ทั้งหมดของอินดิเคเตอร์";
const description = `รวมทุกเครื่องมือใน ${site.name} — FVG, Order Block, Liquidity Sweep, Demand/Supply, BOS, CHoCH, สัญญาณ Buy/Sell และเครื่องมือขั้นสูงอีก 9 รายการ สำหรับวิเคราะห์กราฟ XAUUSD บน TradingView`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/features" },
  openGraph: { title: `${title} | ${site.name}`, description, url: `${site.url}/features` },
};

function FeatureList({ items }: { items: typeof coreFeatures }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => (
        <Link
          key={f.slug}
          href={`/features/${f.slug}`}
          className="group flex flex-col rounded-2xl border border-border bg-surface/60 p-5 transition-colors hover:border-brand/40"
        >
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon name={f.icon} className="h-5 w-5" />
          </span>
          <h3 className="mt-3.5 font-display text-base font-semibold leading-tight">{f.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.desc}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
            อ่านรายละเอียด
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function FeaturesIndexPage() {
  const cheapest = Math.min(...plans.map((p) => p.priceTHB));

  return (
    <main className="container-x max-w-6xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: title,
          description,
          itemListElement: allFeatures.map((f, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: f.title,
            url: `${site.url}/features/${f.slug}`,
          })),
        }}
      />

      <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-muted">{description}</p>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">ระบบหลัก</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{coreIntro}</p>
        <FeatureList items={coreFeatures} />
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold">เครื่องมือขั้นสูง</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{advancedIntro}</p>
        <FeatureList items={advancedTools} />
      </section>

      <section className="mt-16 rounded-2xl border border-brand/30 bg-brand/5 p-8 text-center">
        <h2 className="font-display text-2xl font-bold">ได้ทุกฟีเจอร์ในแพ็กเกจเดียว</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
          ทุกแพ็กเกจได้เครื่องมือครบเหมือนกัน ต่างกันแค่ระยะเวลาและราคาเฉลี่ยต่อเดือน
          เริ่มต้น {formatTHB(cheapest)}
        </p>
        <Link
          href="/#pricing"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
        >
          ดูราคาแพ็กเกจ
        </Link>
      </section>
    </main>
  );
}
