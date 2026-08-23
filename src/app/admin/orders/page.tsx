/* eslint-disable @next/next/no-img-element */
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { approveOrder, rejectOrder } from "@/lib/actions/payment";

const statusStyle: Record<string, string> = {
  PENDING: "text-muted border-border bg-surface-2",
  SUBMITTED: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  APPROVED: "text-up border-up/30 bg-up/10",
  REJECTED: "text-down border-down/30 bg-down/10",
};
const statusLabel: Record<string, string> = {
  PENDING: "รอโอน", SUBMITTED: "รอตรวจสลิป", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ",
};

export default async function OrdersPage() {
  const orders = await prisma.slipOrder.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING", "APPROVED", "REJECTED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">ออเดอร์ / ตรวจสลิป</h1>
        <p className="mt-1 text-sm text-muted">ตรวจสลิปที่สมาชิกแนบมา แล้วกด &quot;อนุมัติ&quot; เพื่อเปิดสิทธิ์อัตโนมัติ</p>
      </div>

      {orders.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-sm text-muted">ยังไม่มีออเดอร์</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const plan = plans.find((p) => p.id === o.planCode);
            return (
              <div key={o.id} className="card-surface flex flex-wrap items-start gap-4 rounded-2xl p-5">
                {o.slipData ? (
                  <a href={o.slipData} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={o.slipData} alt="สลิป" className="h-28 w-28 rounded-lg border border-border object-cover" />
                  </a>
                ) : (
                  <div className="grid h-28 w-28 shrink-0 place-items-center rounded-lg border border-border text-xs text-muted">ยังไม่มีสลิป</div>
                )}
                <div className="min-w-[180px] flex-1">
                  <div className="font-medium">{o.user.name ?? o.user.email}</div>
                  <div className="text-xs text-muted">{o.user.email}</div>
                  <div className="mt-2 text-sm">{plan?.name ?? o.planCode} · <b>{formatTHB(o.amountTHB)}</b></div>
                  <div className="mt-1 text-xs text-muted">{new Date(o.createdAt).toLocaleString("th-TH")}</div>
                  <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[o.status]}`}>
                    {statusLabel[o.status] ?? o.status}
                  </span>
                </div>
                {o.status !== "APPROVED" && (
                  <div className="flex shrink-0 gap-2">
                    <form action={approveOrder}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="rounded-full bg-up/15 px-4 py-2 text-xs font-medium text-up hover:bg-up/25">อนุมัติ</button>
                    </form>
                    {o.status !== "REJECTED" && (
                      <form action={rejectOrder}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button className="rounded-full bg-down/15 px-4 py-2 text-xs font-medium text-down hover:bg-down/25">ปฏิเสธ</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
