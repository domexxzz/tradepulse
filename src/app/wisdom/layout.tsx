import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { site } from "@/config/site";
import { Footer } from "@/components/common/Footer";

/** แถบหัวเรียบแบบหน้าฟีเจอร์ — เมนูหลักเป็น anchor ของหน้าแรก ใช้ข้ามหน้าไม่ได้ */
export default function WisdomLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label={`${site.name} หน้าแรก`}>
            <Image src="/images/brand/qvx-logo-hex-v1.png" alt="" width={36} height={36} className="h-9 w-9" />
            <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> ดูแพ็กเกจแบบชำระเงิน
          </Link>
        </div>
      </header>
      {children}
      <Footer />
    </>
  );
}
