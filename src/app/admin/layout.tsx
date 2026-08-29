import { requireAdmin } from "@/lib/admin";
import { PortalShell } from "@/components/portal/PortalShell";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getUserSubscription } from "@/lib/subscription";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  // แอดมินอาจเป็นสมาชิกด้วย — ใช้ตัวเช็คเดียวกับฝั่งสมาชิก ไม่ตั้งสมมติฐานเอง
  const { isActive, daysLeft } = await getUserSubscription(session.user.id);

  return (
    <PortalShell
      badge="ADMIN"
      profile={{
        name: session.user.name ?? session.user.email ?? "",
        isMember: isActive,
        daysLeft,
      }}
      sidebar={<AdminSidebar />}
    >
      {children}
    </PortalShell>
  );
}
