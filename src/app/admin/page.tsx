import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/utils";
import { Users, CreditCard, ClipboardList, Wallet } from "lucide-react";

export default async function AdminDashboard() {
  const [users, activeSubs, pendingGrants, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.accessGrant.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({ _sum: { amountTHB: true }, where: { status: "paid" } }),
  ]);

  const recent = await prisma.accessGrant.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: true },
  });

  const stats = [
    { label: "สมาชิกทั้งหมด", value: users, icon: Users },
    { label: "แพ็คเกจใช้งานอยู่", value: activeSubs, icon: CreditCard },
    { label: "คิวรออนุมัติสิทธิ์", value: pendingGrants, icon: ClipboardList },
    { label: "รายได้รวม", value: formatTHB(revenue._sum.amountTHB ?? 0), icon: Wallet },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">แดชบอร์ด</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface rounded-2xl p-5">
            <s.icon className="h-6 w-6 text-brand" />
            <div className="mt-3 font-display text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">คิวรออนุมัติล่าสุด</h2>
          <Link href="/admin/access-queue" className="text-sm text-brand hover:underline">ดูทั้งหมด →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="card-surface rounded-2xl p-6 text-sm text-muted">ไม่มีคิวรออนุมัติ</div>
        ) : (
          <div className="card-surface divide-y divide-border/50 overflow-hidden rounded-2xl">
            {recent.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{g.user.name ?? g.user.email}</div>
                  <div className="text-xs text-muted">
                    TV: {g.tradingViewUsername ?? "— ยังไม่กรอก —"}
                  </div>
                </div>
                <span className="text-xs text-muted">
                  {new Date(g.createdAt).toLocaleDateString("th-TH")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
