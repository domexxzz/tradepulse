import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { plans, planIncludes, type Plan } from "@/config/plans";
import { plansForUser } from "@/lib/pricing";
import { paymentMode } from "@/config/site";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate } from "@/lib/date";
import { createQrOrder } from "@/lib/actions/payment";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";
import { Check } from "lucide-react";

function PlanCards({ plans: list }: { plans: Plan[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((p) => {
        const cls = p.highlight
          ? "inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
          : "inline-flex h-11 w-full items-center justify-center rounded-full border border-brand/40 text-sm font-semibold text-brand transition-colors hover:bg-brand/10";
        return (
          <div key={p.id} className={`relative flex flex-col rounded-2xl border p-5 ${p.highlight ? "border-brand/60 bg-surface" : "border-border card-surface"}`}>
            {p.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-ink">{p.badge}</span>
            )}
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            <div className="mt-3 display text-[length:var(--display-sm)]">{formatTHB(p.priceTHB)}</div>
            <p className="mt-1 text-xs text-muted">เฉลี่ย {formatTHB(p.perMonthTHB)}/เดือน</p>
            {p.savingsTHB > 0 && (
              <p className="mt-2 inline-flex w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">ประหยัด {formatTHB(p.savingsTHB)}</p>
            )}
            <div className="mt-5">
              {paymentMode === "qr" ? (
                <form action={createQrOrder}>
                  <input type="hidden" name="planCode" value={p.id} />
                  <button className={cls}>สมัคร · โอนผ่าน QR</button>
                </form>
              ) : (
                <CheckoutButton planCode={p.id} className={cls}>สมัครสมาชิก</CheckoutButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function SubscriptionPage() {
  const session = await auth();
  const { sub, isActive, daysLeft } = await getUserSubscription(session!.user.id);
  const userPlans = await plansForUser(session!.user.id);
  const plan = plans.find((p) => p.id === sub?.planCode);

  return (
    <div className="space-y-8">
      <h1 className="display text-[length:var(--display-sm)]">แพ็คเกจของฉัน</h1>

      {isActive && sub ? (
        <>
          <div className="card-surface max-w-xl rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted">แพ็คเกจปัจจุบัน</div>
                <div className="display text-lg">{plan?.name ?? sub.planCode}</div>
              </div>
              {plan && <div className="display text-lg">{formatTHB(plan.priceTHB)}</div>}
            </div>
            <div className="mt-4 space-y-1 text-sm text-muted">
              <div>สถานะ: <span className="text-up">กำลังใช้งาน</span></div>
              {sub.currentPeriodEnd && (
                <div>
                  ใช้ได้ถึง: {formatThaiDate(sub.currentPeriodEnd)}
                  {daysLeft !== null && (
                    <span className={daysLeft <= 3 ? " text-down" : ""}> · เหลือ {Math.max(0, daysLeft)} วัน</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-semibold">ต่ออายุ / เปลี่ยนแพ็กเกจ</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              โอนใหม่เพื่อต่ออายุการใช้งาน (ระบบ QR ไม่ตัดเงินอัตโนมัติ) —
              ต่อก่อนหมดวัน ระบบจะทบวันที่เหลือให้ ไม่เสียของเดิม
            </p>
            <PlanCards plans={userPlans} />
          </div>
        </>
      ) : (
        <div>
          <h2 className="font-semibold">{sub ? "แพ็กเกจหมดอายุแล้ว — ต่ออายุได้เลย" : "เลือกแพ็กเกจ"}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {sub
              ? `แพ็กเกจก่อนหน้าหมดอายุเมื่อ ${sub.currentPeriodEnd ? formatThaiDate(sub.currentPeriodEnd) : "-"} — เลือกแพ็กเกจเพื่อกลับมาใช้งานต่อ`
              : "เลือกแพ็กเกจแล้วชำระผ่าน PromptPay (สแกน QR + แนบสลิป)"}
          </p>
          <PlanCards plans={userPlans} />
        </div>
      )}

      <div className="max-w-2xl rounded-2xl border border-border card-surface p-6">
        <h3 className="font-semibold">ทุกแพ็กเกจได้รับ</h3>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {planIncludes.map((x) => (
            <li key={x} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
