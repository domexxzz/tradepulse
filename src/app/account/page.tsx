import Link from "next/link";
import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { CheckCircle2, AlertCircle, LineChart } from "lucide-react";

export default async function AccountOverview() {
  const session = await auth();
  const userId = session!.user.id;
  const { sub, isActive } = await getUserSubscription(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = plans.find((p) => p.id === sub?.planCode);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">
        สวัสดี, {session!.user.name ?? "สมาชิก"} 👋
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-surface rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            {isActive ? <CheckCircle2 className="h-4 w-4 text-up" /> : <AlertCircle className="h-4 w-4 text-down" />}
            สถานะสมาชิก
          </div>
          <div className="mt-2 font-display text-xl font-bold">
            {isActive ? `กำลังใช้งาน · ${plan?.name ?? sub?.planCode ?? ""}` : "ยังไม่มีแพ็คเกจ"}
          </div>
          {sub?.currentPeriodEnd && (
            <p className="mt-1 text-sm text-muted">
              ต่ออายุ/หมดอายุ: {new Date(sub.currentPeriodEnd).toLocaleDateString("th-TH")}
            </p>
          )}
          {!isActive && (
            <Link href="/#pricing" className="mt-4 inline-block text-sm text-brand hover:underline">
              เลือกแพ็คเกจ →
            </Link>
          )}
        </div>

        <div className="card-surface rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <LineChart className="h-4 w-4 text-brand" />
            TradingView Username
          </div>
          <div className="mt-2 font-display text-xl font-bold">
            {user?.tradingViewUsername ?? "ยังไม่ได้ตั้งค่า"}
          </div>
          <Link href="/account/tradingview" className="mt-4 inline-block text-sm text-brand hover:underline">
            {user?.tradingViewUsername ? "แก้ไข" : "ตั้งค่าเพื่อรับสิทธิ์"} →
          </Link>
        </div>
      </div>

      {!isActive && (
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6">
          <p className="text-sm">
            เริ่มต้นใช้งานอินดิเคเตอร์เพียง{" "}
            <span className="font-semibold text-brand">
              {formatTHB(Math.min(...plans.map((p) => p.priceTHB)))}/เดือน
            </span>{" "}
            — <Link href="/#pricing" className="underline">ดูแพ็คเกจทั้งหมด</Link>
          </p>
        </div>
      )}
    </div>
  );
}
