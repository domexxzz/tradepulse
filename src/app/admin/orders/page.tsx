/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { approveOrder, rejectOrder } from "@/lib/actions/payment";
import { slipVerifyEnabled } from "@/lib/slip-verify";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

const PER_PAGE = 20;

const statusStyle: Record<string, string> = {
  PENDING: "text-muted border-border bg-surface-2",
  SUBMITTED: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  APPROVED: "text-up border-up/30 bg-up/10",
  REJECTED: "text-down border-down/30 bg-down/10",
};
const statusLabel: Record<string, string> = {
  PENDING: "รอโอน",
  SUBMITTED: "รอตรวจสลิป",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
};

const TABS = [
  { key: "SUBMITTED", label: "รอตรวจสลิป" },
  { key: "PENDING", label: "รอโอน" },
  { key: "APPROVED", label: "อนุมัติแล้ว" },
  { key: "REJECTED", label: "ปฏิเสธ" },
  { key: "ALL", label: "ทั้งหมด" },
];

/** ป้ายผลตรวจสลิปอัตโนมัติ — ช่วยให้แอดมินรู้ว่าใบไหนควรดูละเอียด */
function VerifyBadge({ status, note }: { status: string | null; note: string | null }) {
  if (!status || status === "SKIPPED") return null;

  const map: Record<string, { cls: string; icon: typeof ShieldCheck; text: string }> = {
    VERIFIED: { cls: "text-up border-up/30 bg-up/10", icon: ShieldCheck, text: "ยอดตรง" },
    MISMATCH: { cls: "text-down border-down/30 bg-down/10", icon: ShieldAlert, text: "ยอดไม่ตรง" },
    DUPLICATE: { cls: "text-down border-down/30 bg-down/10", icon: ShieldAlert, text: "สลิปซ้ำ" },
    FAILED: { cls: "text-muted border-border bg-surface-2", icon: ShieldQuestion, text: "อ่านสลิปไม่ได้" },
  };
  const v = map[status] ?? map.FAILED;

  return (
    <span
      title={note ?? undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${v.cls}`}
    >
      <v.icon className="h-3.5 w-3.5" />
      {v.text}
    </span>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : "SUBMITTED";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = status === "ALL" ? {} : { status };

  // ห้าม select slipData ที่นี่ — รูป base64 ของ 20 ออเดอร์ทำให้หน้าหนักเป็นสิบเมกะไบต์
  // รูปโหลดทีละใบผ่าน /api/admin/slip/[id] แทน
  const [orders, total, counts] = await Promise.all([
    prisma.slipOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        planCode: true,
        amountTHB: true,
        status: true,
        slipHash: true,
        verifyStatus: true,
        verifyNote: true,
        note: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.slipOrder.count({ where }),
    prisma.slipOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (key: string) =>
    key === "ALL"
      ? counts.reduce((s, c) => s + c._count._all, 0)
      : counts.find((c) => c.status === key)?._count._all ?? 0;

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">ออเดอร์ / ตรวจสลิป</h1>
        <p className="mt-1 text-sm text-muted">
          ตรวจสลิปที่สมาชิกแนบมา แล้วกด &quot;อนุมัติ&quot; เพื่อเปิดสิทธิ์อัตโนมัติ
          {slipVerifyEnabled
            ? " — ระบบอ่านยอดในสลิปให้แล้ว ดูป้ายผลตรวจประกอบได้"
            : " (ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ)"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?status=${t.key}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              t.key === status
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {t.label} ({countOf(t.key)})
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-sm text-muted">ไม่มีออเดอร์ในหมวดนี้</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const plan = plans.find((p) => p.id === o.planCode);
            return (
              <div key={o.id} className="card-surface flex flex-wrap items-start gap-4 rounded-2xl p-5">
                {o.slipHash ? (
                  <a href={`/api/admin/slip/${o.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img
                      src={`/api/admin/slip/${o.id}`}
                      alt="สลิป"
                      loading="lazy"
                      className="h-28 w-28 rounded-lg border border-border object-cover"
                    />
                  </a>
                ) : (
                  <div className="grid h-28 w-28 shrink-0 place-items-center rounded-lg border border-border text-xs text-muted">
                    ยังไม่มีสลิป
                  </div>
                )}

                <div className="min-w-[200px] flex-1">
                  <div className="font-medium">{o.user.name ?? o.user.email}</div>
                  <div className="text-xs text-muted">{o.user.email}</div>
                  <div className="mt-2 text-sm">
                    {plan?.name ?? o.planCode} · <b>{formatTHB(o.amountTHB)}</b>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {new Date(o.createdAt).toLocaleString("th-TH")}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[o.status]}`}>
                      {statusLabel[o.status] ?? o.status}
                    </span>
                    <VerifyBadge status={o.verifyStatus} note={o.verifyNote} />
                  </div>
                  {o.verifyNote && o.verifyStatus !== "VERIFIED" && (
                    <p className="mt-2 text-xs text-muted">{o.verifyNote}</p>
                  )}
                  {o.note && <p className="mt-1 text-xs text-down">เหตุผลที่ปฏิเสธ: {o.note}</p>}
                </div>

                {o.status !== "APPROVED" && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <form action={approveOrder}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="w-full rounded-full bg-up/15 px-4 py-2 text-xs font-medium text-up hover:bg-up/25">
                        อนุมัติ
                      </button>
                    </form>
                    {o.status !== "REJECTED" && (
                      <form action={rejectOrder} className="flex flex-col gap-2">
                        <input type="hidden" name="orderId" value={o.id} />
                        <input
                          name="reason"
                          placeholder="เหตุผล (ไม่บังคับ)"
                          className="w-40 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-down/50"
                        />
                        <button className="rounded-full bg-down/15 px-4 py-2 text-xs font-medium text-down hover:bg-down/25">
                          ปฏิเสธ
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/orders?status=${status}&page=${page - 1}`} className="text-brand hover:underline">
              ← ก่อนหน้า
            </Link>
          )}
          <span className="text-muted">หน้า {page} / {pages}</span>
          {page < pages && (
            <Link href={`/admin/orders?status=${status}&page=${page + 1}`} className="text-brand hover:underline">
              ถัดไป →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
