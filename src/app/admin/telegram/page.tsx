import { prisma } from "@/lib/prisma";
import { grantTelegram, revokeTelegram } from "@/lib/actions/admin";

const statusStyle: Record<string, string> = {
  PENDING: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  PENDING_REMOVE: "text-down border-down/30 bg-down/10",
  ADDED: "text-up border-up/30 bg-up/10",
  REMOVED: "text-muted border-border bg-surface-2",
};
const statusLabel: Record<string, string> = {
  PENDING: "รอเพิ่มเข้ากลุ่ม",
  PENDING_REMOVE: "หมดอายุ — รอนำออก",
  ADDED: "อยู่ในกลุ่มแล้ว",
  REMOVED: "นำออกแล้ว",
};

export default async function TelegramQueuePage() {
  const grants = await prisma.telegramGrant.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">คิวสิทธิ์กลุ่ม Telegram</h1>
        <p className="mt-1 text-sm text-muted">
          เมื่อสมาชิกจ่ายเงินจะขึ้นคิว &quot;รอเพิ่มเข้ากลุ่ม&quot; — เพิ่มเข้ากลุ่มจริงแล้วกด &quot;เพิ่มเข้ากลุ่ม&quot;
          เมื่อหมดอายุให้กด &quot;นำออก&quot; แล้วเตะออกจากกลุ่ม
        </p>
      </div>

      {grants.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-sm text-muted">ยังไม่มีคำขอสิทธิ์ Telegram</div>
      ) : (
        <div className="card-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-border/60 text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">สมาชิก</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-5 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{g.user.name ?? "—"}</div>
                    <div className="text-xs text-muted">{g.user.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[g.status]}`}>
                      {statusLabel[g.status] ?? g.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {new Date(g.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {g.status !== "ADDED" && (
                        <form action={grantTelegram}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25">
                            เพิ่มเข้ากลุ่ม
                          </button>
                        </form>
                      )}
                      {g.status !== "REMOVED" && (
                        <form action={revokeTelegram}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25">
                            นำออก
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
