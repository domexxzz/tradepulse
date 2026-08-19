import Link from "next/link";
import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { BillingPortalButton } from "@/components/account/BillingPortalButton";

export default async function SubscriptionPage() {
  const session = await auth();
  const { sub, isActive } = await getUserSubscription(session!.user.id);
  const plan = plans.find((p) => p.id === sub?.planCode);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold">แพ็คเกจของฉัน</h1>

      {isActive && sub ? (
        <div className="card-surface rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted">แพ็คเกจปัจจุบัน</div>
              <div className="font-display text-xl font-bold">{plan?.name ?? sub.planCode}</div>
            </div>
            {plan && <div className="text-right font-display text-xl font-bold">{formatTHB(plan.priceTHB)}</div>}
          </div>
          <div className="mt-4 space-y-1 text-sm text-muted">
            <div>สถานะ: <span className="text-up">{sub.status}</span></div>
            {sub.currentPeriodEnd && (
              <div>รอบถัดไป: {new Date(sub.currentPeriodEnd).toLocaleDateString("th-TH")}</div>
            )}
            {sub.cancelAtPeriodEnd && <div className="text-down">จะยกเลิกเมื่อสิ้นรอบปัจจุบัน</div>}
          </div>
          <div className="mt-6">
            <BillingPortalButton />
          </div>
        </div>
      ) : (
        <div className="card-surface rounded-2xl p-6 text-center">
          <p className="text-muted">คุณยังไม่มีแพ็คเกจที่ใช้งานอยู่</p>
          <Link
            href="/#pricing"
            className="mt-4 inline-block rounded-full bg-gradient-to-r from-brand-strong to-brand-deep px-6 py-2.5 text-sm font-semibold text-black"
          >
            เลือกแพ็คเกจ
          </Link>
        </div>
      )}
    </div>
  );
}
