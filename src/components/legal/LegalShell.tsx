import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { site, hasLineContact } from "@/config/site";
import { legal, hasLegalEntity, LEGAL_LAST_UPDATED } from "@/config/legal";
import { Footer } from "@/components/common/Footer";

/**
 * โครงหน้ากฎหมาย — หัวข้อ + วันที่อัปเดต + เนื้อหา + ช่องทางติดต่อ
 * ใช้ header แบบเรียบ (ไม่ใช่ Navbar หลัก) เพราะเมนูหลักเป็น anchor ของหน้าแรก
 */
export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label={`${site.name} หน้าแรก`}>
            {/* โลโก้ตัวจริง ไม่ใช่ตัวอักษรตัวแรกในกล่องเขียว
                ตอนเพิ่มโลโก้เข้า Navbar กับ Footer หน้ากฎหมายถูกมองข้ามไป
                เหลือ placeholder เดิมค้างอยู่ที่เดียวในเว็บ
                alt ว่างเพราะข้อความ "QVX" ข้าง ๆ บอกชื่อแบรนด์อยู่แล้ว */}
            <Image
              src="/images/brand/qvx-logo-hex-v1.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
          </Link>
        </div>
      </header>

      <main className="container-x max-w-3xl py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-xs text-muted">อัปเดตล่าสุด {LEGAL_LAST_UPDATED}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-muted">{intro}</p>

        <article
          className={[
            "mt-10 space-y-4 text-[15px] leading-relaxed text-muted",
            "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
            "[&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:text-[15px]",
            "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
            "[&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
          ].join(" ")}
        >
          {children}
        </article>

        <ContactBlock />
      </main>

      <Footer />
    </>
  );
}

/** ช่องทางติดต่อ — แสดงเฉพาะช่องทางที่ตั้งค่าไว้จริง ไม่สร้างข้อมูลปลอม */
function ContactBlock() {
  const hasEmail = Boolean(site.contact.email);

  return (
    <section className="mt-12 rounded-2xl border border-border bg-surface p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">ติดต่อเรา</h2>
      <p className="mt-2 text-sm text-muted">
        หากมีคำถามเกี่ยวกับนโยบายนี้ หรือต้องการใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคลของคุณ ติดต่อได้ตามช่องทางต่อไปนี้
      </p>

      <ul className="mt-4 space-y-2 text-sm text-muted">
        {hasLegalEntity && (
          <li>
            <span className="text-foreground">ผู้ให้บริการ:</span> {legal.entityName}
            {legal.taxId ? ` (เลขประจำตัวผู้เสียภาษี ${legal.taxId})` : ""}
          </li>
        )}
        {legal.address && (
          <li>
            <span className="text-foreground">ที่อยู่:</span> {legal.address}
          </li>
        )}
        {hasEmail && (
          <li>
            <span className="text-foreground">อีเมล:</span>{" "}
            <a href={`mailto:${site.contact.email}`} className="text-brand underline underline-offset-2">
              {site.contact.email}
            </a>
          </li>
        )}
        {hasLineContact && (
          <li>
            <span className="text-foreground">LINE:</span>{" "}
            <a
              href={site.contact.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline underline-offset-2"
            >
              ติดต่อผ่าน LINE
            </a>
          </li>
        )}
        <li>
          <span className="text-foreground">หน้าช่วยเหลือ:</span>{" "}
          <Link href="/account/support" className="text-brand underline underline-offset-2">
            แจ้งเรื่องผ่านบัญชีสมาชิก
          </Link>
        </li>
      </ul>
    </section>
  );
}
