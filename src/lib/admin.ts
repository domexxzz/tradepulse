import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** ตรวจสิทธิ์แอดมิน — ใช้ใน layout/actions ของ /admin */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/account");
  return session;
}
