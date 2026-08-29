import Link from "next/link";
import { ProfileBadge, type PortalProfile } from "@/components/portal/ProfileBadge";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * โครงหน้าของพอร์ทัลสมาชิกและแดชบอร์ดแอดมิน
 *
 * รวมไว้ที่เดียวเพราะสองส่วนนี้เคยเป็นโค้ดคนละชุดที่หน้าตาเกือบเหมือนกัน
 * พอแก้ดีไซน์ทีต้องแก้สองที่และมักลืมไปข้างหนึ่ง
 */
export function PortalShell({
  badge,
  profile,
  sidebar,
  children,
}: {
  /** ป้ายข้าง ๆ โลโก้ เช่น ADMIN — ไม่ใส่ก็ได้ */
  badge?: string;
  /** คนที่ล็อกอินอยู่ + สถานะสมาชิก */
  profile: PortalProfile;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} หน้าแรก`}>
            <span className="grid h-8 w-8 place-items-center rounded-[.6rem] bg-brand font-display text-sm font-bold text-brand-ink">
              {site.name.charAt(0)}
            </span>
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">{site.name}</span>
            {badge && (
              <span className="pill-brand rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider">
                {badge}
              </span>
            )}
          </Link>
          <ProfileBadge {...profile} />
        </div>
      </header>

      <div className="container-x grid gap-x-10 gap-y-8 py-10 md:grid-cols-[15rem_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">{sidebar}</aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

/**
 * หัวเรื่องของแต่ละหน้า — เดิมเขียน h1 ซ้ำแบบเดียวกัน 20 ที่
 * ทำให้ระยะห่างและขนาดเพี้ยนกันเองทีละนิดจนไม่เป็นระบบ
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="display text-[length:var(--display-sm)]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
