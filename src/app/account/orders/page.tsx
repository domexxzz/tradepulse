import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  PENDING: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  SUBMITTED: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  APPROVED: "text-up border-up/30 bg-up/10",
  REJECTED: "text-down border-down/30 bg-down/10",
};
const statusLabel: Record<string, string> = {
  PENDING: "รอชำระเงิน",
  SUBMITTED: "รอตรวจสลิป",
  APPROVED: "สำเร็จ",
  REJECTED: "ถูกปฏิเสธ",
};

export default async function OrdersHistoryPage() {
  const session = await auth();
  const orders = await prisma.slipOrder.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    // ไม่ดึง slipData — รูป base64 ของทุกออเดอร์ทำให้หน้านี้หนักโดยไม่ได้ใช้
    select: {
      id: true,
      planCode: true,
      amountTHB: true,
      status: true,
      note: true,
      createdAt: true,
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="display text-[length:var(--display-sm)]">ประวัติออเดอร์</h1>

      {orders.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-center text-sm text-muted">
          ยังไม่มีออเดอร์ — <Link href="/#pricing" className="text-brand hover:underline">เลือกแพ็กเกจ</Link>
          {/* คนที่โอนนอกระบบมาแล้วจะไม่มีออเดอร์เลย ถ้าไม่บอกไว้ตรงนี้
              เขาจะสรุปว่าเงินหาย ทั้งที่แค่ต้องแนบสลิปให้เราเห็น */}
          <p className="mt-3">
            โอนเงินมาแล้วแต่ไม่เห็นออเดอร์?{" "}
            <Link href="/account/pay/transferred" className="text-brand hover:underline">
              แนบสลิปที่นี่
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const plan = plans.find((p) => p.id === o.planCode);
            return (
              <div key={o.id} className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl p-5">
                <div className="min-w-[120px]">
                  <div className="font-semibold">{plan?.name ?? o.planCode}</div>
                  <div className="text-xs text-muted">{new Date(o.createdAt).toLocaleString("th-TH")}</div>
                </div>
                <div className="font-display text-lg font-bold">{formatTHB(o.amountTHB)}</div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[o.status]}`}>
                  {statusLabel[o.status] ?? o.status}
                </span>
                {o.status === "REJECTED" && o.note && (
                  <p className="w-full text-xs text-down">เหตุผล: {o.note}</p>
                )}
                <div className="ml-auto">
                  {o.status === "PENDING" ? (
                    /* คำว่า "ชำระเงิน" อย่างเดียวทำให้คนที่โอนไปแล้วไม่กล้ากด
                       เพราะกลัวโดนเก็บเงินซ้ำ แล้วก็ไปทักแอดมินแทน */
                    <Link href={`/account/pay/${o.id}`} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-strong">
                      ชำระเงิน / แนบสลิป
                    </Link>
                  ) : o.status === "SUBMITTED" ? (
                    <Link href={`/account/pay/${o.id}`} className="text-xs text-brand hover:underline">ดูสถานะ</Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
