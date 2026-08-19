import { prisma } from "@/lib/prisma";

const ACTIVE = ["ACTIVE", "TRIALING"];

export default async function MembersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">สมาชิก ({users.length})</h1>

      <div className="card-surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border/60 text-left text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">ชื่อ / อีเมล</th>
              <th className="px-5 py-3 font-medium">TradingView</th>
              <th className="px-5 py-3 font-medium">แพ็คเกจ</th>
              <th className="px-5 py-3 font-medium">บทบาท</th>
              <th className="px-5 py-3 font-medium">สมัครเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const sub = u.subscriptions[0];
              const active = sub && ACTIVE.includes(sub.status);
              return (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{u.name ?? "—"}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {u.tradingViewUsername ? `@${u.tradingViewUsername}` : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {active ? (
                      <span className="text-up">{sub.planCode}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={u.role === "ADMIN" ? "text-brand" : "text-muted"}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
