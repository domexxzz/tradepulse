"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CreditCard, LineChart, ReceiptText, ScrollText, MessageCircle, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

const links = [
  { href: "/account", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/account/subscription", label: "แพ็คเกจของฉัน", icon: CreditCard },
  { href: "/account/orders", label: "ประวัติออเดอร์", icon: ScrollText },
  { href: "/account/tradingview", label: "TradingView", icon: LineChart },
  { href: "/account/billing", label: "ประวัติการชำระ", icon: ReceiptText },
  { href: "/account/support", label: "ช่วยเหลือ", icon: MessageCircle },
];

export function AccountSidebar() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = path === l.href;
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
