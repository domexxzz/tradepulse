import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { site } from "@/config/site";
import { Footer } from "@/components/common/Footer";

/** โครงหน้าฟีเจอร์ — header เรียบเหมือนหน้ากฎหมาย เพราะเมนูหลักเป็น anchor ของหน้าแรก */
export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label={`${site.name} หน้าแรก`}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-background">
              {site.name.charAt(0)}
            </span>
            <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
          </Link>
          <Link
            href="/#features"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
          </Link>
        </div>
      </header>
      {children}
      <Footer />
    </>
  );
}
