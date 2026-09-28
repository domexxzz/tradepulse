import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { site } from "@/config/site";
import { MANUAL_CHAPTERS, manualBySlug, manualNeighbours, type ManualTerm } from "@/config/manual";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return MANUAL_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = manualBySlug(slug);
  if (!c) return { title: "ไม่พบบทนี้" };
  return {
    title: `${c.title} — คู่มือ QVX`,
    description: c.summary,
    alternates: { canonical: `/manual/${c.slug}` },
    openGraph: {
      title: `${c.title} | ${site.name}`,
      description: c.summary,
      url: `${site.url}/manual/${c.slug}`,
      type: "article",
    },
  };
}

/** สีหัวข้อย่อยให้ตรงกับสีบนกราฟจริง — เขียว=ฝั่งซื้อ แดง=ฝั่งขาย เหลือง=ต้องดูบริบทเพิ่ม */
const toneClass: Record<NonNullable<ManualTerm["tone"]>, string> = {
  up: "text-up",
  down: "text-down",
  warn: "text-amber-400",
  info: "text-foreground",
};

export default async function ManualChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = manualBySlug(slug);
  if (!chapter) notFound();

  const { index, prev, next } = manualNeighbours(slug);
  const total = MANUAL_CHAPTERS.length;

  return (
    <main className="container-x max-w-3xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: chapter.title,
          description: chapter.summary,
          isPartOf: { "@type": "Course", name: "คู่มือเรียนรู้ QVX ทีละขั้น", url: `${site.url}/manual` },
          publisher: { "@type": "Organization", name: site.name, url: site.url },
        }}
      />

      <nav aria-label="เส้นทางหน้า" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          หน้าแรก
        </Link>
        <span className="px-1.5">/</span>
        <Link href="/manual" className="hover:text-foreground">
          คู่มือเรียนรู้
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{chapter.title}</span>
      </nav>

      <p className="mt-6 text-sm font-medium text-up">{chapter.eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{chapter.title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{chapter.summary}</p>

      {/* ความคืบหน้า — บอกว่าอยู่บทไหนจากทั้งหมด ให้รู้ว่าเหลืออีกเท่าไหร่ */}
      <div className="mt-6 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-up" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <span className="tnum shrink-0 text-xs text-muted">
          {index + 1} / {total}
        </span>
      </div>

      <article className="mt-10 space-y-10">
        {chapter.blocks.map((b, bi) => (
          <section key={bi} className="space-y-4">
            {b.heading && <h2 className="font-display text-xl font-bold">{b.heading}</h2>}

            {b.body?.map((p, pi) => (
              <p key={pi} className="leading-relaxed text-muted">
                {p}
              </p>
            ))}

            {b.steps && (
              <ol className="space-y-4">
                {b.steps.map((s, si) => (
                  <li key={si} className="flex gap-4">
                    <span className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-up/15 text-sm font-bold text-up">
                      {si + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">{s.title}</span>
                      <span className="mt-1 block leading-relaxed text-muted">{s.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {b.terms && (
              <dl className="space-y-3">
                {b.terms.map((t, ti) => (
                  <div key={ti} className="card-surface rounded-xl p-4">
                    <dt className={`font-semibold ${toneClass[t.tone ?? "info"]}`}>{t.term}</dt>
                    <dd className="mt-1 leading-relaxed text-muted">{t.desc}</dd>
                  </div>
                ))}
              </dl>
            )}

            {b.caution && (
              <p className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-relaxed">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <span className="font-semibold text-amber-400">ข้อควรระวัง</span> — {b.caution}
                </span>
              </p>
            )}
          </section>
        ))}
      </article>

      {chapter.seeAlso && chapter.seeAlso.length > 0 && (
        <div className="card-surface mt-10 rounded-2xl p-5">
          <p className="text-sm font-medium">อ่านต่อแบบละเอียด</p>
          <ul className="mt-3 space-y-2 text-sm">
            {chapter.seeAlso.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="inline-flex items-center gap-1.5 text-up hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ปุ่มเลื่อนหน้า — หัวใจของคู่มือ อ่านจบแล้วกดต่อได้เลยไม่ต้องกลับสารบัญ */}
      <nav className="mt-12 grid gap-3 sm:grid-cols-2" aria-label="บทก่อนหน้าและบทถัดไป">
        {prev ? (
          <Link href={`/manual/${prev.slug}`} className="card-surface group rounded-2xl p-4 transition hover:border-up/40">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowLeft className="h-3.5 w-3.5" />
              บทก่อนหน้า
            </span>
            <span className="mt-1 block font-medium group-hover:text-up">{prev.title}</span>
          </Link>
        ) : (
          <Link href="/manual" className="card-surface group rounded-2xl p-4 transition hover:border-up/40">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowLeft className="h-3.5 w-3.5" />
              กลับสารบัญ
            </span>
            <span className="mt-1 block font-medium group-hover:text-up">คู่มือเรียนรู้ QVX</span>
          </Link>
        )}

        {next ? (
          <Link
            href={`/manual/${next.slug}`}
            className="card-surface group rounded-2xl p-4 text-right transition hover:border-up/40"
          >
            <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
              บทถัดไป
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="mt-1 block font-medium group-hover:text-up">{next.title}</span>
          </Link>
        ) : (
          <Link
            href="/features"
            className="card-surface group rounded-2xl p-4 text-right transition hover:border-up/40"
          >
            <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
              อ่านจบแล้ว
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="mt-1 block font-medium group-hover:text-up">ดูทุกฟีเจอร์พร้อมภาพจริง</span>
          </Link>
        )}
      </nav>
    </main>
  );
}
