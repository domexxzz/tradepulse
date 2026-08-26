import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate, daysUntil } from "@/lib/date";
import { ACTIVE_STATUSES } from "@/lib/subscription";
import { channelLabel } from "@/config/channels";
import { PageHeader } from "@/components/portal/PortalShell";
import { Users, CreditCard, ClipboardList, Wallet, Receipt, CalendarClock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

/** ตัวเลขที่ต้องลงมือทำอะไรบางอย่าง ให้เด่นกว่าตัวเลขที่ดูเฉย ๆ */
function Stat({
  label, value, href, icon: Icon, urgent = false,
}: {
  label: string; value: string | number; href: string;
  icon: typeof Users; urgent?: boolean;
}) {
  const needsAction = urgent && Number(value) > 0;
  return (
    <Link
      href={href}
      className={`card-lift rounded-xl border p-5 ${
        needsAction ? "border-brand/40 bg-brand-wash" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className={`h-5 w-5 ${needsAction ? "text-brand" : "text-faint"}`} />
        <ArrowRight className="h-3.5 w-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className={`display tnum mt-4 text-2xl ${needsAction ? "text-brand" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </Link>
  );
}

export default async function AdminDashboard() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 864e5);

  /** ใช้งานอยู่จริง = ยังไม่ปิดสถานะ และยังไม่ถึงวันหมดอายุ (Stripe คุมรอบบิลของตัวเอง) */
  const activeWhere = {
    status: { in: ACTIVE_STATUSES },
    OR: [{ currentPeriodEnd: { gt: now } }, { stripeSubscriptionId: { not: null } }],
  };

  const [users, activeSubs, pendingGrants, revenue, pendingSlips, expiringSoon, byChannel] =
    await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: activeWhere }),
      prisma.accessGrant.count({ where: { status: { in: ["PENDING", "PENDING_REVOKE"] } } }),
      prisma.payment.aggregate({ _sum: { amountTHB: true }, where: { status: "paid" } }),
      prisma.slipOrder.count({ where: { status: "SUBMITTED" } }),
      prisma.subscription.count({
        where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gte: now, lte: in7Days } },
      }),
      prisma.payment.groupBy({
        by: ["provider"],
        where: { status: "paid" },
        _sum: { amountTHB: true },
        _count: { _all: true },
      }),
    ]);

  const [queue, expiring] = await Promise.all([
    prisma.accessGrant.findMany({
      where: { status: { in: ["PENDING", "PENDING_REVOKE"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, tradingViewUsername: true, user: { select: { name: true, email: true } } },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gte: now, lte: in7Days } },
      orderBy: { currentPeriodEnd: "asc" },
      take: 5,
      select: { id: true, planCode: true, currentPeriodEnd: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  const totalRevenue = revenue._sum.amountTHB ?? 0;

  return (
    <>
      <PageHeader
        title="แดชบอร์ด"
        description="ตัวเลขที่ขึ้นสีเขียวคือมีงานรออยู่ กดเข้าไปจัดการได้เลย"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="สลิปรอตรวจ" value={pendingSlips} href="/admin/orders" icon={Receipt} urgent />
        <Stat label="คิวสิทธิ์ค้าง" value={pendingGrants} href="/admin/access-queue" icon={ClipboardList} urgent />
        <Stat label="หมดอายุใน 7 วัน" value={expiringSoon} href="/admin/members" icon={CalendarClock} urgent />
        <Stat label="สมาชิกทั้งหมด" value={users} href="/admin/members" icon={Users} />
        <Stat label="แพ็คเกจใช้งานอยู่" value={activeSubs} href="/admin/members" icon={CreditCard} />
        <Stat label="รายได้รวม" value={formatTHB(totalRevenue)} href="/admin/orders" icon={Wallet} />
      </div>

      {byChannel.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-muted">รายได้แยกตามช่องทาง</h2>
          <div className="card-surface divide-y divide-border overflow-hidden rounded-xl">
            {[...byChannel]
              .sort((a, b) => (b._sum.amountTHB ?? 0) - (a._sum.amountTHB ?? 0))
              .map((c) => {
                const amount = c._sum.amountTHB ?? 0;
                const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0;
                return (
                  <div key={c.provider} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{channelLabel(c.provider)}</span>
                      <span className="tnum shrink-0">
                        <b>{formatTHB(amount)}</b>
                        <span className="ml-2 text-xs text-faint">{c._count._all} รายการ · {pct}%</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted">คิวสิทธิ์ TradingView</h2>
            <Link href="/admin/access-queue" className="text-xs text-brand hover:underline">ดูทั้งหมด</Link>
          </div>
          {queue.length === 0 ? (
            <p className="card-surface rounded-xl p-5 text-sm text-faint">ไม่มีคิวค้าง</p>
          ) : (
            <div className="card-surface divide-y divide-border overflow-hidden rounded-xl">
              {queue.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{g.user.name ?? g.user.email}</div>
                    <div className="truncate font-mono text-xs text-faint">
                      {g.tradingViewUsername ? `@${g.tradingViewUsername}` : "ยังไม่กรอก username"}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs ${g.status === "PENDING_REVOKE" ? "text-down" : "text-brand"}`}>
                    {g.status === "PENDING_REVOKE" ? "รอถอนสิทธิ์" : "รออนุมัติ"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted">ใกล้หมดอายุ (7 วัน)</h2>
            <Link href="/admin/members" className="text-xs text-brand hover:underline">ดูสมาชิก</Link>
          </div>
          {expiring.length === 0 ? (
            <p className="card-surface rounded-xl p-5 text-sm text-faint">ยังไม่มีใครใกล้หมดอายุ</p>
          ) : (
            <div className="card-surface divide-y divide-border overflow-hidden rounded-xl">
              {expiring.map((s) => {
                const left = s.currentPeriodEnd ? Math.max(0, daysUntil(s.currentPeriodEnd)) : null;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{s.user.name ?? s.user.email}</div>
                      <div className="text-xs text-faint">{s.planCode}</div>
                    </div>
                    <span className="tnum shrink-0 text-right text-xs">
                      <span className={left !== null && left <= 3 ? "text-down" : "text-muted"}>
                        เหลือ {left} วัน
                      </span>
                      <span className="block text-faint">
                        {s.currentPeriodEnd && formatThaiDate(s.currentPeriodEnd)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
