import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getUserSubscription } from "@/lib/subscription";
import { rejectionMessage } from "@/lib/broker";
import { BROKERS, DEFAULT_BROKER } from "@/config/brokers";
import { BROKER_APPLICATION_STATUS as S } from "@/config/status";
import { formatThaiDate } from "@/lib/date";
import { BrokerReviewActions } from "@/components/admin/BrokerReviewActions";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  [S.PENDING]: "รอตรวจ",
  [S.REVIEWING]: "กำลังเปิดสิทธิ์",
  [S.APPROVED]: "อนุมัติแล้ว",
  [S.REJECTED]: "ปฏิเสธ",
};
const statusStyle: Record<string, string> = {
  [S.PENDING]: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  [S.REVIEWING]: "text-brand border-brand/30 bg-brand/10",
  [S.APPROVED]: "text-up border-up/30 bg-up/10",
  [S.REJECTED]: "text-muted border-border bg-surface-2",
};

export default async function AdminWisdomPage() {
  await requireAdmin();
  const broker = BROKERS[DEFAULT_BROKER];

  const [open, recent] = await Promise.all([
    prisma.brokerApplication.findMany({
      where: { status: { in: [S.PENDING, S.REVIEWING] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true, name: true, tradingViewUsername: true } } },
    }),
    prisma.brokerApplication.findMany({
      where: { status: { in: [S.APPROVED, S.REJECTED] } },
      orderBy: { reviewedAt: "desc" },
      take: 30,
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  // สถานะสิทธิ์ปัจจุบันของคนที่รอตรวจ — ช่วยตัดสินคำขอต่ออายุ
  const subs = new Map(
    await Promise.all(open.map(async (a) => [a.userId, await getUserSubscription(a.userId)] as const))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">คำขอรับสิทธิ์ผ่าน {broker.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          เข้าไปตรวจในระบบ {broker.name} ว่าเลขบัญชีนี้มีจริง สมัครผ่านลิงก์ของ QVX และฝากไม่ต่ำกว่า $
          {broker.qvxMinDepositUSD} แล้วกดอนุมัติ — ระบบเปิดสิทธิ์ 1 เดือน พร้อมเพิ่มอินดิเคเตอร์ ห้อง Telegram
          และยศ Discord ให้เอง ไม่ต้องทำมือต่อ
        </p>
        {!broker.signupUrl && (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-400">
            ยังไม่ได้ตั้ง NEXT_PUBLIC_WISDOM_SIGNUP_URL — หน้าลูกค้าจะไม่โชว์ปุ่มสมัคร
            ต้องใช้ลิงก์แนะนำของ QVX เท่านั้น ลิงก์ทั่วไปทำให้บัญชีไม่นับเป็นของ QVX
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">รอตรวจ ({open.length})</h2>
        {open.length === 0 ? (
          <div className="card-surface rounded-xl p-6 text-sm text-muted">ไม่มีคำขอค้าง</div>
        ) : (
          <div className="card-surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">สมาชิก</th>
                  <th className="px-5 py-3 font-medium">เลขบัญชีเทรด</th>
                  <th className="px-5 py-3 font-medium">TradingView</th>
                  <th className="px-5 py-3 font-medium">สิทธิ์ตอนนี้</th>
                  <th className="px-5 py-3 text-right font-medium">ตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {open.map((a) => {
                  const sub = subs.get(a.userId);
                  const tvChanged = a.user.tradingViewUsername && a.user.tradingViewUsername !== a.tradingViewUsername;
                  return (
                    <tr key={a.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium">{a.user.name ?? a.user.email}</div>
                        <div className="text-xs text-muted">{a.user.email}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {a.isRenewal && (
                            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">ต่ออายุ</span>
                          )}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyle[a.status]}`}>
                            {statusLabel[a.status]}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono tnum">{a.tradingAccount}</td>
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs">{a.tradingViewUsername}</div>
                        {tvChanged && (
                          <div className="mt-1 text-[11px] text-amber-400">
                            ตอนนี้เปลี่ยนเป็น {a.user.tradingViewUsername} — บอทจะเพิ่มให้ชื่อใหม่
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {sub?.isActive
                          ? `เหลือ ${sub.daysLeft} วัน`
                          : "ไม่มีสิทธิ์"}
                        <div className="mt-0.5">ส่ง {formatThaiDate(a.createdAt)}</div>
                      </td>
                      <td className="px-5 py-3">
                        <BrokerReviewActions applicationId={a.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">ตรวจแล้วล่าสุด</h2>
        {recent.length === 0 ? (
          <div className="card-surface rounded-xl p-6 text-sm text-muted">ยังไม่มี</div>
        ) : (
          <div className="card-surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">{a.user.name ?? a.user.email}</td>
                    <td className="px-5 py-3 font-mono tnum text-xs">{a.tradingAccount}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[a.status]}`}>
                        {statusLabel[a.status]}
                      </span>
                      {a.status === S.REJECTED && (
                        <div className="mt-1 text-xs text-muted">{rejectionMessage(a.rejectionReason, a.reviewNote)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{a.reviewedAt ? formatThaiDate(a.reviewedAt) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
