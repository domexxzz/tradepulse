"use client";
// ต้องเป็น client component เพราะรายการเมนูมีคอมโพเนนต์ไอคอนอยู่ข้างใน
// ส่งจาก server ไป client ไม่ได้ (React serialize คอมโพเนนต์ข้ามฝั่งไม่ได้)
// build ผ่านแต่พังตอนรันจริง ถ้าลืมบรรทัดนี้
import {
  LayoutDashboard, CreditCard, LineChart, ReceiptText,
  ScrollText, MessageCircle, Star, Hash,
} from "lucide-react";
import { PortalNav, type NavLink } from "@/components/portal/PortalNav";

const links: NavLink[] = [
  { href: "/account", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/account/subscription", label: "แพ็คเกจของฉัน", icon: CreditCard },
  { href: "/account/tradingview", label: "TradingView", icon: LineChart },
  { href: "/account/discord", label: "Discord", icon: Hash },
  { href: "/account/orders", label: "ประวัติออเดอร์", icon: ScrollText },
  { href: "/account/billing", label: "ประวัติการชำระ", icon: ReceiptText },
  { href: "/account/reviews", label: "รีวิวของฉัน", icon: Star },
  { href: "/account/support", label: "ช่วยเหลือ", icon: MessageCircle },
];

export function AccountSidebar() {
  return <PortalNav links={links} />;
}
