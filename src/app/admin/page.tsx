import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate, daysUntil } from "@/lib/date";
import { ACTIVE_STATUSES } from "@/lib/subscription";
import { Users, CreditCard, ClipboardList, Wallet, Receipt, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  /** ใช้งานอยู่จริง = สถานะยังไม่ปิด และยังไม่ถึงวันหมดอายุ (Stripe คุมรอบบิลของตัวเอง) */
  const activeWhere = {
    status: { in: ACTIVE_STATUSES },
    OR: [{ currentPeriodEnd: { gt: now } }, { stripeSubscriptionId: { not: null } }],
  };

  const [users, activeSubs, pendingGrants, revenue, pendingSlips, expiringSoon] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: activeWhere }),
    prisma.accessGrant.count({ where: { status: { in: ["PENDING", "PENDING_REVOKE"] } } }),
    prisma.payment.aggregate({ _sum: { amountTHB: true }, where: { status: "paid" } }),
    prisma.slipOrder.count({ where: { status: "SUBMITTED" } }),
    prisma.subscription.count({
      where: {
        status: { in: ACTIVE_STATUSES },
        currentPeriodEnd: { gte: now, lte: in7Days },
      },
    }),
  ]);

  const stats = [
    { label: "สมาชิกทั้งหมด", value: users, icon: Users, href: "/admin/members" },
    { label: "แพ็คเกจใช้งานอยู่", value: activeSubs, icon: CreditCard, href: "/admin/members" },
    { label: "สลิปรอตรวจ", value: pendingSlips, icon: Receipt, href: "/admin/orders" },
    { label: "คิวสิทธิ์ค้าง", value: pendingGrants, icon: ClipboardList, href: "/admin/access-queue" },
    { label: "หมดอายุใน 7 วัน", value: expiringSoon, icon: CalendarClock, href: "/admin/members" },
    { label: "รายได้รวม", value: formatTHB(revenue._sum.amountTHB ?? 0), icon: Wallet, href: "/admin/orders" },
  ];

  const [queue, expiring] = await Promise.all([
    prisma.accessGrant.findMany({
      where: { status: { in: ["PENDING", "PENDING_REVOKE"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, tradingViewUsername: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gte: now, lte: in7Days } },
      orderBy: { currentPeriodEnd: "asc" },
      take: 5,
      select: { id: true, planCode: true, currentPeriodEnd: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">แดชบอร์ด</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card-surface rounded-2xl p-5 transition-colors hover:border-brand/40">
            <s.icon className="h-6 w-6 text-brand" />
            <div className="mt-3 font-display text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">คิวสิทธิ์ TradingView</h2>
            <Link href="/admin/access-queue" className="text-sm text-brand hover:underline">ดูทั้งหมด →</Link>
          </div>
          {queue.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-sm text-muted">ไม่มีคิวค้าง</div>
          ) : (
            <div className="card-surface divide-y divide-border/50 overflow-hidden rounded-2xl">
              {queue.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.user.name ?? g.user.email}</div>
                    <div className="text-xs text-muted">TV: {g.tradingViewUsername ?? "— ยังไม่กรอก —"}</div>
                  </div>
                  <span className={`shrink-0 text-xs ${g.status === "PENDING_REVOKE" ? "text-down" : "text-amber-400"}`}>
                    {g.status === "PENDING_REVOKE" ? "รอถอนสิทธิ์" : "รออนุมัติ"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">ใกล้หมดอายุ (7 วัน)</h2>
            <Link href="/admin/members" className="text-sm text-brand hover:underline">ดูสมาชิก →</Link>
          </div>
          {expiring.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-sm text-muted">ยังไม่มีใครใกล้หมดอายุ</div>
          ) : (
            <div className="card-surface divide-y divide-border/50 overflow-hidden rounded-2xl">
              {expiring.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.user.name ?? s.user.email}</div>
                    <div className="text-xs text-muted">{s.planCode}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {s.currentPeriodEnd && `${formatThaiDate(s.currentPeriodEnd)} · เหลือ ${Math.max(0, daysUntil(s.currentPeriodEnd))} วัน`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
