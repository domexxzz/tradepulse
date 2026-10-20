"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * โลโก้พาไปหน้าเปิดใช้งาน (/activation) ไม่ใช่หน้าแรก — เลยต้องมี "หน้าแรก" ในเมนูแทน
 * ไม่ใส่ใน site.nav เพราะ footer ใช้ชุดเดียวกัน และ footer ไม่ต้องมีลิงก์หน้าแรก
 */
const NAV_ITEMS = [
  { label: "หน้าแรก", href: "/" },
  // แท็บไปหน้าเปิดใช้งานผ่านโบรก — ให้เห็นชัดกว่าการรู้ว่าต้องกดโลโก้
  { label: "เปิดใช้งานผ่าน Wisdom", href: "/activation" },
  ...site.nav,
];

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
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="container-x flex h-16 items-center justify-between" aria-label="เมนูหลัก">
        <Link href="/activation" className="flex items-center gap-2" aria-label={`เปิดใช้งาน ${site.name} Indicator`}>
          {/* โลโก้พื้นใส — ข้างในหกเหลี่ยมโปร่ง พื้นเว็บทะลุขึ้นมาเอง
              ไม่ใส่กรอบหรือพื้นหลังทับ เพราะตัวโลโก้มีกรอบหกเหลี่ยมอยู่แล้ว
              alt ว่างเพราะข้อความ "QVX" ข้าง ๆ บอกชื่อแบรนด์อยู่แล้ว
              ถ้าใส่ alt ซ้ำ screen reader จะอ่านชื่อสองรอบ */}
          {/* 44px คือเพดานในแถบสูง 64px — เหลือระยะบน-ล่างข้างละ 10px
              ใหญ่กว่านี้โลโก้จะชนขอบ navbar */}
          <Image
            src="/images/brand/qvx-logo-hex-v1.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11"
          />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">{site.name}</span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="relative py-1 text-sm text-muted transition-colors hover:text-foreground
                         after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left
                         after:scale-x-0 after:bg-brand after:transition-transform hover:after:scale-x-100"
            >
              {n.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a href="/login" className="text-sm font-medium text-muted transition-colors hover:text-foreground">
            เข้าสู่ระบบ
          </a>
          {/* ของเดิมเขียน "เริ่มใช้งาน" แล้วเลื่อนลงไปตารางราคา ซึ่งไม่ได้พาไปไหน
              คนที่ตั้งใจสมัครต้องเลื่อนหาปุ่มสมัครเองอีกที — พาร์ตเนอร์ขอให้ชี้ตรงไปหน้าสมัครเลย */}
          <Button href="/register" size="md">สมัครสมาชิก</Button>
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
            {NAV_ITEMS.map((n) => (
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
            <Button href="/register" className="mt-2" onClick={() => setOpen(false)}>สมัครสมาชิก</Button>
          </div>
        </div>
      )}
    </header>
  );
}
