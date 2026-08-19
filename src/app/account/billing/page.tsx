import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/utils";

export default async function BillingPage() {
  const session = await auth();
  const payments = await prisma.payment.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold">ประวัติการชำระเงิน</h1>
      {payments.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-sm text-muted">ยังไม่มีประวัติการชำระเงิน</div>
      ) : (
        <div className="card-surface overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-5 py-3 font-medium">จำนวน</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-3">{new Date(p.createdAt).toLocaleDateString("th-TH")}</td>
                  <td className="px-5 py-3">{formatTHB(p.amountTHB)}</td>
                  <td className="px-5 py-3">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
