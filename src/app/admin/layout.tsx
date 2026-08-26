import { requireAdmin } from "@/lib/admin";
import { PortalShell } from "@/components/portal/PortalShell";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <PortalShell
      badge="ADMIN"
      who={session.user.name ?? session.user.email ?? ""}
      sidebar={<AdminSidebar />}
    >
      {children}
    </PortalShell>
  );
}
