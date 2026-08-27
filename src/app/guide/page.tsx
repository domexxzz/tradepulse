import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { site } from "@/config/site";
import { guideSuites, mediaNote, sharedCautions, sharedFlow } from "@/config/guide";
import { plansFor } from "@/config/plans";
import { getPromoState } from "@/lib/pricing";
import { formatTHB } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { SuiteSection } from "@/components/guide/SuiteSection";

const title = "คู่มือตั้งค่าและแนวใช้งานอินดิเคเตอร์";
const description = `วิธีตั้งค่า ${site.name} ให้ได้หน้าชาร์ตแบบตัวอย่าง — ครบทั้ง 3 ชุด: SMC Unified Suite, Gold Booster + Gold Core และ ICT SD Signal พร้อมค่าตั้งจริงทุกช่อง ภาพหน้าชาร์ต และคลิปสาธิตบน XAUUSD`;

// ราคาใน CTA ต้องตามโปรที่เหลืออยู่จริง จึงรีเฟรชด้วยจังหวะเดียวกับหน้าแรก
export const revalidate = 300;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guide" },
  openGraph: {
    title: `${title} | ${site.name}`,
    description,
    url: `${site.url}/guide`,
    type: "article",
  },
};

export default async function GuidePage() {
  const promo = await getPromoState();
  const cheapest = Math.min(...plansFor(promo.monthlyTHB).map((p) => p.priceTHB));

  return (
    <main className="container-x max-w-5xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: title,
          description,
          step: sharedFlow.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s,
          })),
        }}
      />

      <nav aria-label="เส้นทางหน้า" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          หน้าแรก
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">คู่มือใช้งาน</span>
      </nav>

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">{description}</p>

      <p className="mt-6 flex gap-3 rounded-xl border border-border bg-surface/60 p-4 text-sm leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>{mediaNote}</span>
      </p>

      <nav aria-label="ไปยังชุดอินดิเคเตอร์" className="mt-8 flex flex-wrap gap-2.5">
        {guideSuites.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-brand/40 hover:text-foreground"
          >
            {s.name}
          </a>
        ))}
      </nav>

      <section className="mt-12 rounded-2xl border border-brand/25 bg-brand/5 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">ลำดับการใช้งานที่ใช้ได้ทุกชุด</h2>
        <p className="mt-2 text-sm text-muted">
          ทั้งสามชุดมีเครื่องมือคนละอย่าง แต่ลำดับการตัดสินใจเหมือนกัน
          จำอันนี้ก่อนแล้วค่อยลงรายละเอียดของแต่ละชุด
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sharedFlow.map((s, i) => (
            <li key={s} className="flex gap-3 rounded-xl border border-border bg-background/40 p-4">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground/85">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-16 space-y-16">
        {guideSuites.map((suite) => (
          <SuiteSection key={suite.id} suite={suite} />
        ))}
      </div>

      <section className="mt-16 border-t border-border pt-14">
        <h2 className="font-display text-2xl font-bold">ข้อควรระวังที่ใช้ร่วมกันทุกชุด</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {sharedCautions.map((c) => (
            <li
              key={c}
              className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm leading-relaxed text-foreground/85"
            >
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-2xl border border-brand/30 bg-brand/5 p-8 text-center">
        <h2 className="font-display text-2xl font-bold">อยากได้หน้าชาร์ตแบบในคู่มือนี้</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
          ค่าตั้งทั้งหมดข้างบนใช้ได้เมื่อคุณมีสิทธิ์เข้าถึงอินดิเคเตอร์บน TradingView แล้ว
          ทุกแพ็กเกจได้เครื่องมือครบเหมือนกัน เริ่มต้น {formatTHB(cheapest)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/#pricing"
            className="inline-flex h-11 items-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
          >
            ดูราคาแพ็กเกจ
          </Link>
          <Link
            href="/features"
            className="inline-flex h-11 items-center rounded-full border border-border px-7 text-sm font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground"
          >
            ดูฟีเจอร์รายตัว
          </Link>
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-muted">
        {mediaNote} · ผลในอดีตไม่ได้รับประกันผลในอนาคต การเทรดมีความเสี่ยง
      </p>
    </main>
  );
}
