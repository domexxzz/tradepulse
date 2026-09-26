import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { rejectionMessage } from "@/lib/broker";
import { BROKERS, DEFAULT_BROKER, BROKER_RENEWAL_WINDOW_DAYS } from "@/config/brokers";
import { BROKER_APPLICATION_STATUS as S } from "@/config/status";
import { formatThaiDate } from "@/lib/date";
import { BrokerApplicationForm } from "@/components/account/BrokerApplicationForm";
import { Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountWisdomPage() {
  const session = await auth();
  const userId = session!.user.id;
  const broker = BROKERS[DEFAULT_BROKER];

  const [user, latest, { isActive, daysLeft, sub }] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { tradingViewUsername: true } }),
    prisma.brokerApplication.findFirst({
      where: { userId, broker: broker.id },
      orderBy: { createdAt: "desc" },
    }),
    getUserSubscription(userId),
  ]);

  const waiting = latest && (latest.status === S.PENDING || latest.status === S.REVIEWING);
  const tooEarly = isActive && daysLeft !== null && daysLeft > BROKER_RENEWAL_WINDOW_DAYS;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">รับสิทธิ์ผ่าน {broker.name}</h1>
        <p className="mt-1.5 text-sm text-muted">
          เปิดบัญชีเทรดกับ {broker.fullName} ผ่านลิงก์ของ QVX แล้วรับสิทธิ์ใช้งานครบทุกอย่าง
          เหมือนสมาชิกแบบชำระเงิน — ไม่ต้องจ่ายค่าสมาชิก
        </p>
      </div>

      {/* สถานะคำขอล่าสุด */}
      {latest && (
        <div className="card-surface rounded-xl p-5">
          {waiting && (
            <p className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="font-medium">รอทีมงานตรวจสอบ</span>
              <span className="text-muted">· ส่งเมื่อ {formatThaiDate(latest.createdAt)}</span>
            </p>
          )}
          {latest.status === S.APPROVED && (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-up" />
              <span className="font-medium">ผ่านการตรวจสอบแล้ว</span>
              {isActive && sub?.currentPeriodEnd && (
                <span className="text-muted">· ใช้งานได้ถึง {formatThaiDate(sub.currentPeriodEnd)}</span>
              )}
            </p>
          )}
          {latest.status === S.REJECTED && (
            <div className="text-sm">
              <p className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-down" />
                <span className="font-medium">คำขอไม่ผ่าน</span>
              </p>
              <p className="mt-1.5 text-muted">{rejectionMessage(latest.rejectionReason, latest.reviewNote)}</p>
              {/* คำขอต่ออายุไม่ผ่าน ไม่ได้แปลว่าสิทธิ์รอบนี้โดนตัด — บอกให้ชัด ไม่งั้นลูกค้าตกใจ */}
              {isActive && sub?.currentPeriodEnd && (
                <p className="mt-1.5 text-muted">
                  สิทธิ์รอบปัจจุบันยังใช้ได้ถึง {formatThaiDate(sub.currentPeriodEnd)}
                </p>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-muted tnum">เลขบัญชี {latest.tradingAccount}</p>
        </div>
      )}

      {/* ต้องมี TradingView username ก่อน */}
      {!user?.tradingViewUsername ? (
        <div className="card-surface rounded-xl p-6">
          <h2 className="font-semibold">กรอก TradingView username ก่อน</h2>
          <p className="mt-1.5 text-sm text-muted">
            ผ่านการตรวจแล้วระบบจะเพิ่มสิทธิ์อินดิเคเตอร์ให้บัญชี TradingView นี้ทันที
          </p>
          <Link
            href="/account/tradingview"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-strong"
          >
            ไปกรอก TradingView username
          </Link>
        </div>
      ) : waiting ? null : tooEarly ? (
        <p className="text-sm text-muted">
          คุณยังมีสิทธิ์ใช้งานอีก {daysLeft} วัน — ขอต่ออายุได้เมื่อเหลือไม่เกิน {BROKER_RENEWAL_WINDOW_DAYS} วัน
        </p>
      ) : (
        <>
          <ol className="card-surface space-y-2.5 rounded-2xl p-6 text-sm text-muted">
            <li className="font-medium text-foreground">ขั้นตอน</li>
            <li>
              1. เปิดบัญชี {broker.platform} กับ {broker.name}{" "}
              {broker.signupUrl ? (
                <a
                  href={broker.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand underline underline-offset-2"
                >
                  ผ่านลิงก์ของ QVX <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>— ติดต่อทีมงานเพื่อรับลิงก์สมัคร</span>
              )}
            </li>
            <li>2. ยืนยันตัวตน (KYC) และฝากเงินไม่ต่ำกว่า ${broker.qvxMinDepositUSD}</li>
            <li>3. ส่งเลขบัญชีเทรดด้านล่าง ทีมงานตรวจแล้วเปิดสิทธิ์ให้</li>
            {broker.guideUrl && (
              <li>
                <a
                  href={broker.guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline underline-offset-2"
                >
                  คู่มือเปิดบัญชีแบบละเอียด
                </a>
              </li>
            )}
          </ol>

          <BrokerApplicationForm
            broker={broker.id}
            qvxMinDepositUSD={broker.qvxMinDepositUSD}
            renewal={isActive}
          />
        </>
      )}

      <p className="text-xs text-muted">
        สอบถามเรื่องบัญชีโบรก ฝาก-ถอน ติดต่อ {broker.name} ทาง LINE {broker.supportLine}
      </p>
    </div>
  );
}
