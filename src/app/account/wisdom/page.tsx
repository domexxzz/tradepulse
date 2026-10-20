import Link from "next/link";
import { auth } from "@/auth";
import { getBrokerApplicationView } from "@/lib/broker";
import { BROKERS, DEFAULT_BROKER, BROKER_RENEWAL_WINDOW_DAYS } from "@/config/brokers";
import { BrokerApplicationForm } from "@/components/account/BrokerApplicationForm";
import { BrokerApplicationStatus } from "@/components/account/BrokerApplicationStatus";
import { manualPdf } from "@/config/downloads";
import { ExternalLink, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountWisdomPage() {
  const session = await auth();
  const userId = session!.user.id;
  const broker = BROKERS[DEFAULT_BROKER];

  const { user, latest, subscription, waiting, tooEarly } = await getBrokerApplicationView(userId, broker.id);
  const { isActive, daysLeft, sub } = subscription;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">รับสิทธิ์ผ่าน {broker.name}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          เปิดบัญชีผ่าน QVX และรับสิทธิ์ใช้งานทุกอย่างของ QVX Indicator ตามเงื่อนไขที่กำหนด
          โดยไม่เสียค่าสมาชิก
        </p>
      </div>

      {/* สถานะคำขอล่าสุด */}
      {latest && (
        <BrokerApplicationStatus latest={latest} isActive={isActive} periodEnd={sub?.currentPeriodEnd ?? null} />
      )}

      {waiting ? null : tooEarly ? (
        <p className="text-sm text-muted">
          คุณยังมีสิทธิ์ใช้งานอีก {daysLeft} วัน — ขอต่ออายุได้เมื่อเหลือไม่เกิน {BROKER_RENEWAL_WINDOW_DAYS} วัน
        </p>
      ) : (
        <>
          {/* รู้จักโบรกก่อน แล้วค่อยเงื่อนไข แล้วค่อยฟอร์ม — เรียงตามลำดับที่ลูกค้าตัดสินใจจริง
              ของเดิมเปิดมาเจอฟอร์มเลย ทั้งที่ยังไม่รู้ว่าต้องเปิดบัญชีกับใครและได้อะไร */}
          <div className="card-surface rounded-2xl p-6">
            <h2 className="font-semibold">{broker.fullName}</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">ตลาดที่เทรดได้</dt>
                <dd className="text-right sm:mt-0.5 sm:text-left">{broker.markets}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">เลเวอเรจสูงสุด</dt>
                <dd className="tnum text-right sm:mt-0.5 sm:text-left">{broker.maxLeverage}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">แพลตฟอร์ม</dt>
                <dd className="text-right sm:mt-0.5 sm:text-left">{broker.platform}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">ฝากขั้นต่ำของโบรก</dt>
                <dd className="tnum text-right sm:mt-0.5 sm:text-left">${broker.brokerMinDepositUSD}</dd>
              </div>
            </dl>
          </div>

          <div className="card-surface rounded-2xl p-6">
            <h2 className="font-semibold">เงื่อนไขการรับสิทธิ์ QVX 30 วัน</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              <li>1. เปิดบัญชี {broker.platform} กับ {broker.name} ผ่านลิงก์ของ QVX เท่านั้น</li>
              <li>2. ยืนยันตัวตน (KYC) ให้ผ่าน</li>
              <li>3. ฝากเงินไม่ต่ำกว่า ${broker.qvxMinDepositUSD}</li>
              <li>4. ส่งคำขอด้านล่าง ทีมงานตรวจแล้วเปิดสิทธิ์ให้ 30 วัน</li>
            </ol>
            {/* เตือนตรงนี้เพราะเป็นข้อที่พลาดแล้วเสียเวลาที่สุด — สมัครผ่านลิงก์ทั่วไปแล้วต้องเปิดบัญชีใหม่ทั้งใบ */}
            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed">
              บัญชีที่สมัครผ่านลิงก์อื่นหรือสมัครไว้ก่อนแล้ว จะไม่นับเป็นบัญชีของ QVX และไม่ผ่านการตรวจสอบ
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {broker.signupUrl ? (
                <a
                  href={broker.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-strong"
                >
                  เปิดบัญชีเริ่มต้นใช้งาน <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-sm text-muted">— ติดต่อทีมงานเพื่อรับลิงก์สมัคร</span>
              )}
              {broker.guideUrl && (
                <Link
                  href={broker.guideUrl}
                  className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm hover:bg-surface-2"
                >
                  ดูคู่มือเปิดบัญชี
                </Link>
              )}
              <a
                href={manualPdf("open-account").href}
                download={manualPdf("open-account").fileName}
                target="_blank"
                rel="noopener"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-5 text-sm hover:bg-surface-2"
              >
                <Download className="h-3.5 w-3.5" /> คู่มือ PDF
              </a>
            </div>
          </div>

          <BrokerApplicationForm
            broker={broker.id}
            qvxMinDepositUSD={broker.qvxMinDepositUSD}
            renewal={isActive}
            defaultTvUsername={user?.tradingViewUsername ?? ""}
            defaultEmail={user?.email ?? ""}
          />
        </>
      )}

      <p className="text-xs text-muted">
        สอบถามเรื่องบัญชีโบรก ฝาก-ถอน ติดต่อ {broker.name} ทาง LINE {broker.supportLine}
      </p>
    </div>
  );
}
