import { site, hasLineContact } from "@/config/site";

export function Footer() {
  const year = new Date().getFullYear();
  const hasEmail = Boolean(site.contact.email);

  return (
    <footer className="border-t border-border bg-surface pb-24 md:pb-0">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-background">
              {site.name.charAt(0)}
            </span>
            <span className="font-display text-lg font-bold">{site.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{site.tagline}</p>
        </div>

        <nav aria-label="เมนูส่วนท้าย">
          <h3 className="mb-3 text-sm font-semibold">เมนู</h3>
          <ul className="space-y-2 text-sm text-muted">
            {site.nav.map((n) => (
              <li key={n.href}><a href={n.href} className="hover:text-foreground">{n.label}</a></li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-sm font-semibold">ข้อกำหนด</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><a href="/terms" className="hover:text-foreground">ข้อกำหนดการใช้งาน</a></li>
            <li><a href="/privacy" className="hover:text-foreground">นโยบายความเป็นส่วนตัว</a></li>
            <li><a href="/refund" className="hover:text-foreground">นโยบายการคืนเงิน</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">ติดต่อ / ช่วยเหลือ</h3>
          <ul className="space-y-2 text-sm text-muted">
            {hasLineContact && (
              <li><a href={site.contact.lineUrl} className="hover:text-foreground">ติดต่อผ่าน LINE</a></li>
            )}
            {hasEmail && (
              <li><a href={`mailto:${site.contact.email}`} className="hover:text-foreground">{site.contact.email}</a></li>
            )}
            {!hasLineContact && !hasEmail && (
              <li>ช่องทางช่วยเหลืออยู่ในหน้าบัญชีหลังเข้าสู่ระบบ</li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-x py-5 text-center text-xs text-muted">
          © {year} {site.name} · การเทรดมีความเสี่ยง โปรดใช้วิจารณญาณ
        </div>
      </div>
    </footer>
  );
}
