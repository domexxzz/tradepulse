import Link from "next/link";
import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { syncCheckoutSession } from "@/lib/stripe-sync";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { CheckCircle2, AlertCircle, LineChart, PartyPopper, Send } from "lucide-react";

export default async function AccountOverview({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { checkout, session_id } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  // ซิงก์ทันทีเมื่อกลับจาก Stripe (safety-net เมื่อ webhook ยังไม่ถึง)
  if (checkout === "success" && session_id) {
    await syncCheckoutSession(session_id, userId);
  }

  const { sub, isActive } = await getUserSubscription(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = plans.find((p) => p.id === sub?.planCode);
  const telegramInvite = process.env.TELEGRAM_INVITE_URL;

  return (
    <div className="space-y-6">
      {checkout === "success" && (
        <div className="flex items-start gap-3 rounded-2xl border border-up/30 bg-up/10 p-4">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-up" />
          <div className="text-sm">
            <div className="font-semibold text-up">ชำระเงินสำเร็จ ขอบคุณครับ</div>
            <p className="mt-0.5 text-muted">
              ขั้นต่อไป: ไปที่หน้า{" "}
              <Link href="/account/tradingview" className="text-brand hover:underline">TradingView</Link>{" "}
              เพื่อกรอก username รับสิทธิ์ใช้งานอินดิเคเตอร์
            </p>
          </div>
        </div>
      )}

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

      {isActive && (
        <div className="card-surface rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Send className="h-4 w-4 text-brand" />
            กลุ่มสัญญาณ Telegram (เฉพาะสมาชิก)
          </div>
          {telegramInvite ? (
            <a href={telegramInvite} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-strong">
              เข้ากลุ่ม Telegram
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted">ทีมงานจะส่งลิงก์เชิญกลุ่ม Telegram ให้เร็ว ๆ นี้ (หรือติดต่อผ่านหน้าช่วยเหลือ)</p>
          )}
        </div>
      )}

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
