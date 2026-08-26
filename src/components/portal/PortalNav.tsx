"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** ตัวเลขข้างขวา เช่น จำนวนงานค้าง */
  badge?: number;
}

/**
 * เมนูข้างของพอร์ทัล
 *
 * รายการที่เลือกอยู่ใช้เขียวจุดเดียว (เส้นซ้าย + ตัวอักษร) ไม่ใช่ทั้งแถบพื้นเขียว
 * เพื่อให้สายตายังไปหยุดที่เนื้อหาหลัก ไม่ใช่ที่เมนู
 */
export function PortalNav({ links, exactFirst = true }: { links: NavLink[]; exactFirst?: boolean }) {
  const path = usePathname();
  const root = links[0]?.href;

  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((l) => {
        const active =
          exactFirst && l.href === root ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);

        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm transition-colors",
              active
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-colors",
                active ? "bg-brand" : "bg-transparent"
              )}
            />
            <l.icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-faint")} />
            <span className="truncate">{l.label}</span>
            {l.badge ? (
              <span className="tnum ml-auto rounded-full bg-brand-wash px-1.5 text-xs font-medium text-brand">
                {l.badge}
              </span>
            ) : null}
          </Link>
        );
      })}

      <form action={signOutAction} className="mt-3 border-t border-border pt-3">
        <button className="flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm text-faint transition-colors hover:bg-down/10 hover:text-down">
          <LogOut className="h-4 w-4 shrink-0" />
          ออกจากระบบ
        </button>
      </form>
    </nav>
  );
}
