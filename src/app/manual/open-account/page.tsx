import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, Info } from "lucide-react";
import { site } from "@/config/site";
import { OPEN_ACCOUNT_PARTS, OPEN_ACCOUNT_NOTES, OPEN_ACCOUNT_DISCLAIMER } from "@/config/open-account";
import { JsonLd } from "@/components/seo/JsonLd";

const title = "คู่มือเปิดบัญชี ฝาก–ถอนเงิน กับโบรก Wisdom";
const description =
  "ขั้นตอนเปิดบัญชีเทรดกับ Wisdom Financial Services ตั้งแต่สมัครสมาชิก ยืนยันตัวตน KYC เปิดบัญชีจริง MT5 ฝากเงินผ่าน 24Pay ไปจนถึงการถอนเงิน พร้อมภาพทุกขั้นตอน";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/manual/open-account" },
  openGraph: { title: `${title} | ${site.name}`, description, url: `${site.url}/manual/open-account`, type: "article" },
};

const allSteps = OPEN_ACCOUNT_PARTS.flatMap((p) => p.steps);

export default function OpenAccountGuidePage() {
  return (
    <main className="container-x max-w-4xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: title,
          description,
          step: allSteps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.points.join(" · "),
          })),
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
        <span className="text-foreground">เปิดบัญชีกับ Wisdom</span>
      </nav>

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">{description}</p>

      {/* สารบัญลัด — คู่มือยาว 14 ขั้น ต้องกระโดดไปขั้นที่ค้างได้ */}
      <nav aria-label="ไปยังขั้นตอน" className="mt-8 flex flex-wrap gap-2">
        {allSteps.map((s) => (
          <a
            key={s.badge}
            href={`#step-${s.badge}`}
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs transition hover:border-up/40 hover:text-up"
          >
            {s.badge} · {s.title}
          </a>
        ))}
      </nav>

      {OPEN_ACCOUNT_PARTS.map((part) => (
        <section key={part.id} className="mt-14">
          <h2 className="font-display text-2xl font-bold">{part.title}</h2>
          <p className="mt-2 leading-relaxed text-muted">{part.desc}</p>

          {/* หน้าคั่นจากคู่มือ — บอกล่วงหน้าว่าส่วนนี้มีกี่ขั้น ก่อนลงรายละเอียดทีละขั้น */}
          {part.flow && (
            <div className="mt-6">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                {part.flow.steps.map((label, i) => (
                  <li key={label} className="flex items-center gap-2">
                    {i > 0 && <span className="text-muted">→</span>}
                    <span className="rounded-full border border-border bg-surface-2 px-3 py-1.5">
                      <span className="tnum mr-1.5 font-display font-bold text-up">{i + 1}</span>
                      {label}
                    </span>
                  </li>
                ))}
              </ol>
              <figure className="mt-5 overflow-hidden rounded-2xl border border-border">
                <Image
                  src={part.flow.image.src}
                  alt={part.flow.image.alt}
                  width={part.flow.image.width}
                  height={part.flow.image.height}
                  sizes="(min-width: 1180px) 1140px, 100vw"
                  className="h-auto w-full"
                />
              </figure>
            </div>
          )}

          <div className="mt-8 space-y-12">
            {part.steps.map((s) => (
              <article key={s.badge} id={`step-${s.badge}`} className="scroll-mt-24">
                <div className="flex items-center gap-3">
                  <span className="tnum rounded-lg bg-up/15 px-2.5 py-1 font-display text-sm font-bold text-up">
                    {s.badge}
                  </span>
                  <h3 className="font-display text-xl font-bold">{s.title}</h3>
                </div>

                <ul className="mt-4 space-y-2">
                  {s.points.map((p, pi) => (
                    <li key={pi} className="flex gap-2.5 leading-relaxed text-muted">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-up" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                {s.caution && (
                  <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-relaxed">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      <span className="font-semibold text-amber-400">ข้อควรระวัง</span> — {s.caution}
                    </span>
                  </p>
                )}

                {/* ภาพเต็มหน้าจากคู่มือ — sizes ตรงกับความกว้างจริงของ .container-x ไม่ใช่ max-w-4xl
                    (คอมเมนต์เดียวกับหน้า /features — .container-x อยู่นอก @layer จึงชนะ utility) */}
                <figure className="mt-5 overflow-hidden rounded-2xl border border-border">
                  <Image
                    src={s.image.src}
                    alt={s.image.alt}
                    width={s.image.width}
                    height={s.image.height}
                    sizes="(min-width: 1180px) 1140px, 100vw"
                    className="h-auto w-full"
                  />
                </figure>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">ข้อควรรู้ก่อนทำรายการ</h2>
        <div className="mt-8 space-y-12">
          {OPEN_ACCOUNT_NOTES.map((n) => (
            <article key={n.title}>
              <h3 className="font-display text-xl font-bold">{n.title}</h3>
              <ul className="mt-4 space-y-2">
                {n.points.map((p, pi) => (
                  <li key={pi} className="flex gap-2.5 leading-relaxed text-muted">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-up" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <figure className="mt-5 overflow-hidden rounded-2xl border border-border">
                <Image
                  src={n.image.src}
                  alt={n.image.alt}
                  width={n.image.width}
                  height={n.image.height}
                  sizes="(min-width: 1180px) 1140px, 100vw"
                  className="h-auto w-full"
                />
              </figure>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-12 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 p-5 text-sm leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{OPEN_ACCOUNT_DISCLAIMER}</span>
      </p>

      <nav className="mt-12 grid gap-3 sm:grid-cols-2" aria-label="ไปหน้าอื่น">
        <Link href="/manual" className="card-surface group rounded-2xl p-4 transition hover:border-up/40">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <ArrowLeft className="h-3.5 w-3.5" />
            กลับสารบัญ
          </span>
          <span className="mt-1 block font-medium group-hover:text-up">คู่มือเรียนรู้ QVX</span>
        </Link>
        <Link href="/wisdom" className="card-surface group rounded-2xl p-4 text-right transition hover:border-up/40">
          <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
            ขั้นต่อไป
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
          <span className="mt-1 block font-medium group-hover:text-up">รับสิทธิ์อินดิเคเตอร์ผ่าน Wisdom</span>
        </Link>
      </nav>
    </main>
  );
}
