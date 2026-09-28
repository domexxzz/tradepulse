import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight, FileText } from "lucide-react";
import { site } from "@/config/site";
import { MANUAL_CHAPTERS } from "@/config/manual";
import { JsonLd } from "@/components/seo/JsonLd";

const title = "คู่มือเรียนรู้ QVX ทีละขั้น";
const description =
  "เรียนรู้การใช้ QVX แบบเรียงลำดับ ตั้งแต่พื้นฐาน SMC และ ICT ลำดับการวิเคราะห์ 5 ขั้น การอ่านโซนและสัญญาณบนกราฟ ไปจนถึงการรับสัญญาณผ่าน Telegram";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/manual" },
  openGraph: { title: `${title} | ${site.name}`, description, url: `${site.url}/manual`, type: "article" },
};

export default function ManualIndexPage() {
  return (
    <main className="container-x max-w-4xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: title,
          description,
          provider: { "@type": "Organization", name: site.name, url: site.url },
          hasPart: MANUAL_CHAPTERS.map((c) => ({
            "@type": "CreativeWork",
            name: c.title,
            description: c.summary,
            url: `${site.url}/manual/${c.slug}`,
          })),
        }}
      />

      <nav aria-label="เส้นทางหน้า" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          หน้าแรก
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">คู่มือเรียนรู้</span>
      </nav>

      <div className="mt-4 flex items-start gap-3">
        <BookOpen className="mt-1.5 h-7 w-7 shrink-0 text-up" />
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      </div>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">{description}</p>

      <p className="mt-2 text-sm text-muted">
        อ่านจบหน้าแล้วกดไปหน้าถัดไปได้เลย · {MANUAL_CHAPTERS.length} บท
      </p>

      <ol className="mt-10 space-y-3">
        {MANUAL_CHAPTERS.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/manual/${c.slug}`}
              className="card-surface group flex items-start gap-4 rounded-2xl p-5 transition hover:border-up/40"
            >
              <span className="tnum mt-0.5 w-8 shrink-0 font-display text-lg font-bold text-up">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{c.eyebrow}</span>
                <span className="mt-0.5 block font-display text-lg font-bold">{c.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{c.summary}</span>
              </span>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-up" />
            </Link>
          </li>
        ))}
      </ol>

      {/* คู่มือเล่มที่สอง — คนละเรื่องกับ 10 บทข้างบน จึงแยกการ์ดให้เห็นชัด ไม่ปนในสารบัญ */}
      <Link
        href="/manual/open-account"
        className="card-surface group mt-10 flex items-start gap-4 rounded-2xl border-up/25 p-5 transition hover:border-up/50"
      >
        <FileText className="mt-0.5 h-6 w-6 shrink-0 text-up" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">คู่มืออีกเล่ม · ภาพทุกขั้นตอน</span>
          <span className="mt-0.5 block font-display text-lg font-bold">เปิดบัญชี ฝาก–ถอนเงิน กับโบรก Wisdom</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            ตั้งแต่สมัครสมาชิก ยืนยันตัวตน KYC เปิดบัญชีจริง MT5 ฝากเงินผ่าน 24Pay จนถึงการถอนเงิน
          </span>
        </span>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-up" />
      </Link>

      <div className="card-surface mt-6 rounded-2xl p-5 text-sm leading-relaxed text-muted">
        <p className="font-medium text-foreground">อยากได้รายละเอียดเพิ่ม</p>
        <p className="mt-2">
          <Link href="/features" className="text-up hover:underline">
            ทุกฟีเจอร์พร้อมภาพหน้าชาร์ตจริง
          </Link>{" "}
          ·{" "}
          <Link href="/guide" className="text-up hover:underline">
            ค่าตั้งอินดิเคเตอร์ทีละช่อง
          </Link>{" "}
          ·{" "}
          <Link href="/wisdom" className="text-up hover:underline">
            รับสิทธิ์ผ่านโบรก Wisdom
          </Link>
        </p>
      </div>
    </main>
  );
}
