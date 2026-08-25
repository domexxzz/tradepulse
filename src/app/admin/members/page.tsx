import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { isSubscriptionActive } from "@/lib/subscription";
import { daysUntil, formatThaiDate } from "@/lib/date";
import { adminActivateMembership, adminExpireMembership } from "@/lib/actions/admin";
import { Search } from "lucide-react";

const PER_PAGE = 30;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { tradingViewUsername: { contains: q, mode: "insensitive" as const } },
          { discordUsername: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        tradingViewUsername: true,
        discordUsername: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">สมาชิก ({total})</h1>
        <form className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาอีเมล / ชื่อ / TradingView"
            className="w-72 rounded-full border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted focus:border-brand/50"
          />
        </form>
      </div>

      <div className="card-surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border/60 text-left text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">ชื่อ / อีเมล</th>
              <th className="px-5 py-3 font-medium">ช่องทาง</th>
              <th className="px-5 py-3 font-medium">แพ็คเกจ</th>
              <th className="px-5 py-3 font-medium">หมดอายุ</th>
              <th className="px-5 py-3 font-medium">สมัครเมื่อ</th>
              <th className="px-5 py-3 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const sub = u.subscriptions[0];
              const active = isSubscriptionActive(sub ?? null);
              const left = sub?.currentPeriodEnd ? daysUntil(sub.currentPeriodEnd) : null;
              const planName = plans.find((p) => p.id === sub?.planCode)?.name ?? sub?.planCode;

              return (
                <tr key={u.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">
                      {u.name ?? "—"}
                      {u.role === "ADMIN" && (
                        <span className="ml-2 rounded-full border border-brand/40 px-1.5 py-0.5 text-[10px] text-brand">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <div className="font-mono">
                      {u.tradingViewUsername ? `TV @${u.tradingViewUsername}` : <span className="text-muted">TV —</span>}
                    </div>
                    <div className="font-mono text-muted">
                      {u.discordUsername ? `DC @${u.discordUsername}` : "DC —"}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {active ? (
                      <span className="text-up">{planName}</span>
                    ) : sub ? (
                      <span className="text-muted">{planName} (หมดอายุ)</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {sub?.currentPeriodEnd ? (
                      <>
                        <div>{formatThaiDate(sub.currentPeriodEnd)}</div>
                        {active && left !== null && (
                          <div className={left <= 3 ? "text-down" : "text-muted"}>เหลือ {left} วัน</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{formatThaiDate(u.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col items-end gap-2">
                      <form action={adminActivateMembership} className="flex items-center gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="amountTHB" value="0" />
                        <select
                          name="planCode"
                          defaultValue="MONTH"
                          className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-brand/50"
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button className="rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25">
                          เปิด/ต่ออายุ
                        </button>
                      </form>
                      {active && sub && (
                        <form action={adminExpireMembership}>
                          <input type="hidden" name="subscriptionId" value={sub.id} />
                          <button className="rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25">
                            ปิดสิทธิ์ทันที
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        ปุ่ม &quot;เปิด/ต่ออายุ&quot; ให้สิทธิ์ฟรีโดยไม่บันทึกเป็นรายได้ (ใช้กรณีโอนนอกระบบหรือชดเชย)
        — ต่ออายุจะทบวันที่เหลือให้อัตโนมัติ
      </p>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/members?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-brand hover:underline">
              ← ก่อนหน้า
            </Link>
          )}
          <span className="text-muted">หน้า {page} / {pages}</span>
          {page < pages && (
            <Link href={`/admin/members?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-brand hover:underline">
              ถัดไป →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
