"use client";
import { Landmark } from "lucide-react";
import { PortalNav, type NavLink } from "@/components/portal/PortalNav";

/** พาร์ตเนอร์มีงานเดียว — ไม่ต้องมีเมนูอื่นให้หลงเข้าไป */
const links: NavLink[] = [{ href: "/partner", label: "คำขอผ่าน Wisdom", icon: Landmark }];

export function PartnerSidebar() {
  return <PortalNav links={links} />;
}
