"use client";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-border bg-background/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="container-x flex h-16 items-center justify-between" aria-label="เมนูหลัก">
        <a href="#top" className="flex items-center gap-2" aria-label={`${site.name} หน้าแรก`}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-background">
            {site.name.charAt(0)}
          </span>
          <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
        </a>

        <div className="hidden items-center gap-6 lg:flex">
          {site.nav.map((n) => (
            <a key={n.href} href={n.href} className="text-sm text-muted transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a href="/login" className="text-sm font-medium text-muted transition-colors hover:text-foreground">
            เข้าสู่ระบบ
          </a>
          <Button href="#pricing" size="md">เริ่มใช้งาน</Button>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-lg text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-border bg-background lg:hidden">
          <div className="container-x flex flex-col gap-1 py-3">
            {site.nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
            <a
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
            >
              เข้าสู่ระบบ
            </a>
            <Button href="#pricing" className="mt-2" onClick={() => setOpen(false)}>เริ่มใช้งาน</Button>
          </div>
        </div>
      )}
    </header>
  );
}
