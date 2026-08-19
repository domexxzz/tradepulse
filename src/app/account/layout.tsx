import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { site } from "@/config/site";
import { AccountSidebar } from "@/components/account/AccountSidebar";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-surface/60">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-strong to-brand-deep font-display text-sm font-bold text-black">
              {site.name.charAt(0)}
            </span>
            <span className="font-display text-lg font-bold">{site.name}</span>
          </Link>
          <div className="text-sm text-muted">
            {session.user.name ?? session.user.email}
          </div>
        </div>
      </header>

      <div className="container-x grid gap-8 py-10 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <AccountSidebar />
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
