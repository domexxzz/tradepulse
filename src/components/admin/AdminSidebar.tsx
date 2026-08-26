"use client";
// ต้องเป็น client component เพราะรายการเมนูมีคอมโพเนนต์ไอคอนอยู่ข้างใน
// ส่งจาก server ไป client ไม่ได้ (React serialize คอมโพเนนต์ข้ามฝั่งไม่ได้)
// build ผ่านแต่พังตอนรันจริง ถ้าลืมบรรทัดนี้
import {
  LayoutDashboard, Users, ClipboardCheck, Star,
  CreditCard, Send, Receipt, Mail, Activity,
} from "lucide-react";
import { PortalNav, type NavLink } from "@/components/portal/PortalNav";

/**
 * งานที่ต้องลงมือ (ออเดอร์ คิวสิทธิ์ คิว Telegram) อยู่บนสุด
 * ส่วนที่เอาไว้ดูเฉย ๆ อยู่ล่าง — เรียงตามความถี่ที่แอดมินต้องใช้จริง
 */
const links: NavLink[] = [
  { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/admin/orders", label: "ออเดอร์/สลิป", icon: Receipt },
  { href: "/admin/access-queue", label: "คิวอนุมัติสิทธิ์", icon: ClipboardCheck },
  { href: "/admin/telegram", label: "คิว Telegram", icon: Send },
  { href: "/admin/members", label: "สมาชิก", icon: Users },
  { href: "/admin/reviews", label: "รีวิว", icon: Star },
  { href: "/admin/subscribers", label: "ผู้รับข่าวสาร", icon: Mail },
  { href: "/admin/plans", label: "แพ็คเกจ", icon: CreditCard },
  { href: "/admin/system", label: "สถานะระบบ", icon: Activity },
];

export function AdminSidebar() {
  return <PortalNav links={links} />;
}
