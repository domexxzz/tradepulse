import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { USER_ROLE } from "@/config/status";

/** ตรวจสิทธิ์แอดมิน — ใช้ใน layout/actions ของ /admin */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== USER_ROLE.ADMIN) redirect("/account");
  return session;
}

/**
 * ตรวจสิทธิ์ "ตรวจคำขอโบรก" — แอดมินหรือพาร์ตเนอร์โบรก
 * ใช้กับหน้า/แอ็กชันที่พาร์ตเนอร์ทำได้ (คิวคำขอ Wisdom) เท่านั้น
 */
export async function requireBrokerReviewer() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== USER_ROLE.ADMIN && role !== USER_ROLE.PARTNER) redirect("/account");
  return session;
}

export const isPartner = (role?: string | null) => role === USER_ROLE.PARTNER;
