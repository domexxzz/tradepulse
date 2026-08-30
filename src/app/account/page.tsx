import Link from "next/link";
import { auth } from "@/auth";
import { getUserSubscription } from "@/lib/subscription";
import { syncCheckoutSession } from "@/lib/stripe-sync";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate } from "@/lib/date";
import { PageHeader } from "@/components/portal/PortalShell";
import {
  CheckCircle2, Circle, AlertCircle, LineChart, PartyPopper,
  Send, CalendarClock, ArrowRight,
} from "lucide-react";

/**
 * หน้าภาพรวมของสมาชิก
 *
 * จัดใหม่เป็น "ของที่ได้รับ" เรียงเป็นขั้นตอน แทนการ์ดลอย ๆ
 * เพราะคำถามแรกของคนที่เพิ่งจ่ายเงินคือ "แล้วต้องทำอะไรต่อ" ไม่ใช่ "สถานะฉันคืออะไร"
 */
export default async function AccountOverview({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { checkout, session_id } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  // ซิงก์ทันทีเมื่อกลับจาก Stripe (safety-net เมื่อ webhook ยังไม่ถึง)
  if (checkout === "success" && session_id) await syncCheckoutSession(session_id, userId);

  const { sub, isActive, daysLeft, expiringSoon } = await getUserSubscription(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = plans.find((p) => p.id === sub?.planCode);

  const telegramGrant = isActive
    ? await prisma.telegramGrant.findFirst({
        where: { userId, status: { in: ["PENDING", "ADDED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, inviteLink: true },
      })
    : null;
  const inGroup = telegramGrant?.status === "ADDED";

  // ลิงก์ทักบอทก่อนเข้ากลุ่ม — ทางเดียวที่ทำให้บอทส่ง DM หาสมาชิกได้
  // Telegram ห้ามบอททักคนก่อน สมาชิกต้องกด Start เอง พอกดแล้วบอทตอบลิงก์กลุ่มกลับไปให้
  // ไม่ตั้ง TELEGRAM_BOT_USERNAME = ใช้ลิงก์เชิญตรง ๆ แบบเดิม (แค่ส่ง DM ไม่ได้)
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const telegram = telegramRowCopy({
    inGroup,
    botStartUrl:
      botUsername && telegramGrant?.id
        ? `https://t.me/${botUsername}?start=${telegramGrant.id}`
        : null,
    personalInvite: telegramGrant?.inviteLink ?? null,
    fallbackInvite: process.env.TELEGRAM_INVITE_URL ?? null,
  });
  const cheapest = Math.min(...plans.map((p) => p.perMonthTHB));

  return (
    <>
      {checkout === "success" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-wash p-4">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="text-sm">
            <div className="font-medium text-brand">ชำระเงินสำเร็จ ขอบคุณครับ</div>
            <p className="mt-0.5 text-muted">ทำตามขั้นตอนด้านล่างให้ครบ แล้วเริ่มใช้งานได้เลย</p>
          </div>
        </div>
      )}

      {expiringSoon && daysLeft !== null && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-down/30 bg-down/10 p-4">
          <div className="flex items-start gap-3 text-sm">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-down" />
            <div>
              <div className="font-medium text-down">แพ็กเกจเหลืออีก {Math.max(0, daysLeft)} วัน</div>
              <p className="mt-0.5 text-muted">ต่ออายุก่อนหมดวัน ระบบจะทบวันที่เหลือให้ ไม่เสียของเดิม</p>
            </div>
          </div>
          <Link
            href="/account/subscription"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
          >
            ต่ออายุ
          </Link>
        </div>
      )}

      <PageHeader
        title={`สวัสดี ${session!.user.name ?? "สมาชิก"}`}
        description={
          isActive
            ? "นี่คือของที่คุณได้รับ ทำให้ครบทุกข้อแล้วใช้งานได้เต็มที่"
            : "สมัครแพ็กเกจเพื่อเริ่มใช้อินดิเคเตอร์และเข้ากลุ่มสัญญาณ"
        }
      />

      {/* สถานะแพ็กเกจ */}
      <div className="card-surface rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted">
              {isActive ? (
                <CheckCircle2 className="h-4 w-4 text-brand" />
              ) : (
                <AlertCircle className="h-4 w-4 text-down" />
              )}
              สถานะสมาชิก
            </div>
            <div className="display mt-2 text-lg">
              {isActive ? (plan?.name ?? sub?.planCode) : sub ? "หมดอายุแล้ว" : "ยังไม่มีแพ็กเกจ"}
            </div>
            {sub?.currentPeriodEnd && (
              <p className="tnum mt-1 text-sm text-muted">
                {isActive ? "ใช้ได้ถึง" : "หมดอายุเมื่อ"} {formatThaiDate(sub.currentPeriodEnd)}
                {isActive && daysLeft !== null && ` · เหลือ ${Math.max(0, daysLeft)} วัน`}
              </p>
            )}
          </div>
          <Link
            href="/account/subscription"
            className={
              isActive
                ? "inline-flex h-10 items-center rounded-full border border-border-strong px-5 text-sm transition-colors hover:border-brand/50 hover:text-brand"
                : "inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
            }
          >
            {isActive ? "ต่ออายุ / เปลี่ยนแพ็กเกจ" : `เลือกแพ็กเกจ · เริ่มต้น ${formatTHB(cheapest)}/เดือน`}
          </Link>
        </div>
      </div>

      {/* ของที่ได้รับ — เรียงเป็นขั้นตอนที่ต้องทำให้ครบ */}
      {isActive && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted">ของที่คุณได้รับ</h2>
          <div className="card-surface divide-y divide-border overflow-hidden rounded-xl">
            <DeliveryRow
              done={Boolean(user?.tradingViewUsername)}
              icon={<LineChart className="h-4 w-4" />}
              title="อินดิเคเตอร์บน TradingView"
              detail={
                user?.tradingViewUsername
                  ? `กรอกไว้แล้ว: @${user.tradingViewUsername}`
                  : "กรอก TradingView username เพื่อรับสิทธิ์ใช้งาน"
              }
              href="/account/tradingview"
              cta={user?.tradingViewUsername ? "แก้ไข" : "กรอกเลย"}
            />
            <DeliveryRow
              done={inGroup}
              icon={<Send className="h-4 w-4" />}
              title="กลุ่มสัญญาณ Telegram"
              detail={telegram.detail}
              href={telegram.href}
              cta={telegram.cta}
              external
            />
          </div>
        </section>
      )}
    </>
  );
}

/**
 * ข้อความ ลิงก์ และปุ่มของแถว "กลุ่มสัญญาณ Telegram"
 *
 * แยกออกมาเพราะมีห้าสถานะ เขียนซ้อนใน JSX แล้วอ่านไม่ออก
 * ลำดับสำคัญ: ถ้ามีลิงก์บอทให้ใช้ลิงก์บอทเสมอ แม้สมาชิกจะอยู่ในกลุ่มแล้ว
 * เพราะคนที่เข้ากลุ่มด้วยลิงก์เชิญตรง ๆ ยังไม่เคยกด Start จึงยังรับ DM ไม่ได้
 */
function telegramRowCopy({
  inGroup, botStartUrl, personalInvite, fallbackInvite,
}: {
  inGroup: boolean;
  botStartUrl: string | null;
  personalInvite: string | null;
  fallbackInvite: string | null;
}): { detail: string; href?: string; cta: string } {
  if (botStartUrl) {
    return inGroup
      ? {
          detail: "คุณอยู่ในกลุ่มแล้ว — เชื่อมต่อบอทเพื่อรับหลักฐานสิทธิ์และแจ้งเตือนทางแชทส่วนตัว",
          href: botStartUrl,
          cta: "เชื่อมต่อบอท",
        }
      : {
          detail: "กดคุยกับบอท แล้วบอทจะส่งลิงก์เข้ากลุ่มของคุณให้ทันที",
          href: botStartUrl,
          cta: "เริ่มใช้งาน",
        };
  }
  if (inGroup) return { detail: "คุณอยู่ในกลุ่มแล้ว", cta: "เข้ากลุ่ม" };
  if (personalInvite) {
    return {
      detail: "ลิงก์ของคุณคนเดียว ใช้ได้ครั้งเดียว — ส่งต่อให้คนอื่นจะถูกปฏิเสธ",
      href: personalInvite,
      cta: "เข้ากลุ่ม",
    };
  }
  if (fallbackInvite) {
    return { detail: "กดเข้ากลุ่มรับสัญญาณสด", href: fallbackInvite, cta: "เข้ากลุ่ม" };
  }
  return { detail: "ทีมงานจะส่งลิงก์เชิญให้เร็ว ๆ นี้", cta: "เข้ากลุ่ม" };
}

function DeliveryRow({
  done, icon, title, detail, href, cta, external = false,
}: {
  done: boolean; icon: React.ReactNode; title: string; detail: string;
  href?: string; cta: string; external?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <span className={done ? "text-brand" : "text-faint"}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </span>
      <div className="min-w-[12rem] flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={done ? "text-faint" : "text-brand"}>{icon}</span>
          {title}
        </div>
        <p className="mt-0.5 text-sm text-muted">{detail}</p>
      </div>
      {href && !done && (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      )}
      {href && done && (
        external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            {cta}
          </a>
        ) : (
          <Link href={href} className="text-sm text-muted transition-colors hover:text-brand">
            {cta}
          </Link>
        )
      )}
    </div>
  );
}
