import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal/PortalShell";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { getUserSubscription } from "@/lib/subscription";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // สถานะสมาชิกจริง ไม่ใช่แค่ "มีแพ็กเกจในระบบ" — แพ็กเกจที่หมดอายุก็ยังมี record ค้าง
  const { isActive, daysLeft } = await getUserSubscription(session.user.id);

  return (
    <PortalShell
      profile={{
        name: session.user.name ?? session.user.email ?? "",
        isMember: isActive,
        daysLeft,
      }}
      sidebar={<AccountSidebar isAdmin={session.user.role === "ADMIN"} />}
    >
      {children}
    </PortalShell>
  );
}
