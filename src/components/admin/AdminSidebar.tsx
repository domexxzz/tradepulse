"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ClipboardCheck, Star, CreditCard, Send, Receipt, Mail, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/admin/orders", label: "ออเดอร์/สลิป", icon: Receipt },
  { href: "/admin/access-queue", label: "คิวอนุมัติสิทธิ์", icon: ClipboardCheck },
  { href: "/admin/telegram", label: "คิว Telegram", icon: Send },
  { href: "/admin/members", label: "สมาชิก", icon: Users },
  { href: "/admin/reviews", label: "รีวิว", icon: Star },
  { href: "/admin/subscribers", label: "ผู้รับข่าวสาร", icon: Mail },
  { href: "/admin/plans", label: "แพ็คเกจ", icon: CreditCard },
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = l.href === "/admin" ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
      <form action={signOutAction} className="mt-2">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-down/10 hover:text-down">
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
      </form>
    </nav>
  );
}
