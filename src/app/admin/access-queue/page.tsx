import { prisma } from "@/lib/prisma";
import { grantAccess, revokeAccess, adminRetryTradingView } from "@/lib/actions/admin";

const statusStyle: Record<string, string> = {
  PENDING: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  PENDING_REVOKE: "text-down border-down/30 bg-down/10",
  GRANTED: "text-up border-up/30 bg-up/10",
  REVOKED: "text-muted border-border bg-surface-2",
};
const statusLabel: Record<string, string> = {
  PENDING: "รออนุมัติ",
  PENDING_REVOKE: "หมดอายุ — รอถอนสิทธิ์",
  GRANTED: "อนุมัติแล้ว",
  REVOKED: "ยกเลิก",
};

export default async function AccessQueuePage() {
  const grants = await prisma.accessGrant.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">คิวอนุมัติสิทธิ์ TradingView</h1>
        <p className="mt-1 text-sm text-muted">
          &quot;สั่งบอท&quot; ให้บอทไปเพิ่ม/ถอน username บน TradingView ให้เอง —
          ส่วน &quot;อนุมัติ&quot; กับ &quot;ยกเลิก&quot; เป็นการบันทึกสถานะเฉย ๆ
          ใช้ตอนที่ไปจัดการบน TradingView ด้วยมือเองแล้ว <b className="text-foreground">ไม่ได้สั่งบอท</b>
        </p>
      </div>

      {grants.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-sm text-muted">ยังไม่มีคำขอสิทธิ์</div>
      ) : (
        <div className="card-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">สมาชิก</th>
                <th className="px-5 py-3 font-medium">TradingView</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-5 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{g.user.name ?? "—"}</div>
                    <div className="text-xs text-muted">{g.user.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    {g.tradingViewUsername ? (
                      <span className="font-mono">@{g.tradingViewUsername}</span>
                    ) : (
                      <span className="text-xs text-down">ยังไม่กรอก</span>
                    )}
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
                      {/* ปุ่มเดียวในหน้านี้ที่สั่งบอทจริง — อีกสองปุ่มแค่บันทึกสถานะ */}
                      {g.user.tradingViewUsername && (
                        <form action={adminRetryTradingView}>
                          <input type="hidden" name="userId" value={g.user.id} />
                          <button className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/25">
                            สั่งบอท
                          </button>
                        </form>
                      )}
                      {g.status !== "GRANTED" && (
                        <form action={grantAccess}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25">
                            อนุมัติ
                          </button>
                        </form>
                      )}
                      {g.status !== "REVOKED" && (
                        <form action={revokeAccess}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25">
                            ยกเลิก
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
