import Link from "next/link";
import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { syncCheckoutSession } from "@/lib/stripe-sync";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate } from "@/lib/date";
import { CheckCircle2, AlertCircle, LineChart, PartyPopper, Send, CalendarClock } from "lucide-react";

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

  const { sub, isActive, daysLeft, expiringSoon } = await getUserSubscription(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = plans.find((p) => p.id === sub?.planCode);

  // ลิงก์เชิญส่วนตัว (ใช้ได้ครั้งเดียว) — ถ้ายังไม่ได้เปิดระบบอัตโนมัติจะไม่มีค่านี้
  const telegramGrant = isActive
    ? await prisma.telegramGrant.findFirst({
        where: { userId, status: { in: ["PENDING", "ADDED"] } },
        orderBy: { createdAt: "desc" },
        select: { status: true, inviteLink: true },
      })
    : null;
  const telegramInvite = telegramGrant?.inviteLink ?? process.env.TELEGRAM_INVITE_URL;
  const alreadyInGroup = telegramGrant?.status === "ADDED";

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

      {expiringSoon && daysLeft !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <div className="flex items-start gap-3 text-sm">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <div className="font-semibold text-amber-400">
                แพ็กเกจเหลืออีก {Math.max(0, daysLeft)} วัน
              </div>
              <p className="mt-0.5 text-muted">
                ต่ออายุก่อนหมดวัน ระบบจะทบวันที่เหลือให้ ไม่เสียของเดิม
              </p>
            </div>
          </div>
          <Link
            href="/account/subscription"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-brand-strong"
          >
            ต่ออายุ
          </Link>
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
              {isActive ? "ใช้ได้ถึง" : "หมดอายุเมื่อ"} {formatThaiDate(sub.currentPeriodEnd)}
              {isActive && daysLeft !== null && ` · เหลือ ${Math.max(0, daysLeft)} วัน`}
            </p>
          )}
          {!isActive && (
            <Link href="/account/subscription" className="mt-4 inline-block text-sm text-brand hover:underline">
              {sub ? "ต่ออายุแพ็คเกจ →" : "เลือกแพ็คเกจ →"}
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
          {alreadyInGroup ? (
            <p className="mt-2 text-sm text-up">คุณอยู่ในกลุ่มแล้ว — เปิด Telegram ได้เลย</p>
          ) : telegramInvite ? (
            <>
              <a
                href={telegramInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-strong"
              >
                เข้ากลุ่ม Telegram
              </a>
              {telegramGrant?.inviteLink && (
                <p className="mt-2.5 text-xs text-muted">
                  ลิงก์นี้เป็นของคุณคนเดียว ใช้ได้ครั้งเดียวและผูกกับบัญชีสมาชิกของคุณ
                  — ส่งต่อให้คนอื่นจะถูกปฏิเสธอัตโนมัติ
                </p>
              )}
            </>
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
            — <Link href="/account/subscription" className="underline">ดูแพ็คเกจทั้งหมด</Link>
          </p>
        </div>
      )}
    </div>
  );
}
