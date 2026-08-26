import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal/PortalShell";
import { AccountSidebar } from "@/components/account/AccountSidebar";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PortalShell who={session.user.name ?? session.user.email ?? ""} sidebar={<AccountSidebar />}>
      {children}
    </PortalShell>
  );
}
