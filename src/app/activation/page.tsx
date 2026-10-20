import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { auth } from "@/auth";
import { site } from "@/config/site";
import { BROKERS, DEFAULT_BROKER, BROKER_RENEWAL_WINDOW_DAYS } from "@/config/brokers";
import { getBrokerApplicationView } from "@/lib/broker";
import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { Button } from "@/components/ui/Button";
import { BrokerOverviewCard } from "@/components/activation/BrokerOverviewCard";
import { BrokerApplicationForm } from "@/components/account/BrokerApplicationForm";
import { BrokerApplicationStatus } from "@/components/account/BrokerApplicationStatus";

const broker = BROKERS[DEFAULT_BROKER];

/** ระยะสิทธิ์ต่อรอบ — แพ็กเกจ MONTH (BROKER_PLAN_CODE) เรียกว่า 30 วันเหมือนหน้า /account/wisdom */
const ACCESS_DAYS = 30;

export const metadata: Metadata = {
  title: `เปิดใช้งาน ${site.name} Indicator`,
  description: `รับสิทธิ์ใช้งาน ${site.name} บน TradingView เป็นเวลา ${ACCESS_DAYS} วัน สำหรับบัญชี ${broker.name} ที่เปิดผ่านลิงก์ของ ${site.name} และผ่านเงื่อนไข`,
  alternates: { canonical: "/activation" },
};

// อ่าน session ทุกครั้ง — คนที่ล็อกอินต้องเห็นสถานะคำขอของตัวเอง ไม่ใช่หน้าที่แคชไว้
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "ศึกษาข้อมูล Broker", body: `อ่านรายละเอียดและเงื่อนไขของ ${broker.name} ก่อนตัดสินใจ` },
  { title: "ผ่านเงื่อนไข", body: `เปิดบัญชีผ่านลิงก์ของ ${site.name} และฝากตั้งแต่ $${broker.qvxMinDepositUSD}` },
  { title: "ส่งคำขอเปิดใช้งาน", body: `รับสิทธิ์ ${ACCESS_DAYS} วัน หลังตรวจสอบและอนุมัติ` },
];

/** เงื่อนไขชุดเดียวกับหน้า /wisdom และ /account/wisdom — ตัวเลขดึงจาก config ทั้งหมด */
const CONDITIONS = [
  `เปิดบัญชี ${broker.platform} กับ ${broker.name} ผ่านลิงก์ของ ${site.name} เท่านั้น และยืนยันตัวตน (KYC) ให้ผ่าน`,
  `ฝากเงินไม่ต่ำกว่า $${broker.qvxMinDepositUSD} ตามเงื่อนไขของ ${site.name}`,
  "ทุกคำขอต้องผ่านการตรวจสอบ การส่งข้อมูลไม่ใช่การอนุมัติทันที",
  `สิทธิ์ใช้งานรอบละ ${ACCESS_DAYS} วัน เริ่มเมื่อคำขอได้รับการอนุมัติ`,
  "สิทธิ์ผูกกับเลขบัญชีเทรดและ TradingView Username ที่ส่งคำขอ",
  "หนึ่งบัญชีเทรดใช้รับสิทธิ์ได้หนึ่งคน",
  `บัญชีต้องคงสถานะตามเกณฑ์ของ ${site.name} ตลอดช่วงที่ใช้สิทธิ์`,
  `ขอต่ออายุด้วยบัญชีเดิมได้เมื่อสิทธิ์เหลือไม่เกิน ${BROKER_RENEWAL_WINDOW_DAYS} วัน`,
  "การต่ออายุไม่เป็นไปโดยอัตโนมัติ และต้องผ่านการตรวจสอบอีกครั้ง",
  "หากไม่ต่ออายุหรือไม่ผ่านเงื่อนไข สิทธิ์สิ้นสุดตามวันที่กำหนด",
];

/** พากลับมาหน้านี้หลังล็อกอิน/สมัคร — ฝั่งเซิร์ฟเวอร์กรองด้วย safeCallbackPath อีกชั้น */
const CALLBACK = `callbackUrl=${encodeURIComponent("/activation")}`;

/**
 * หน้าเปิดใช้งาน QVX ผ่านโบรก — โลโก้บน Navbar พามาที่นี่
 *
 * รวมข้อมูลจาก /wisdom (ข้อมูลโบรก + เงื่อนไข) กับฟอร์มของ /account/wisdom ไว้หน้าเดียว
 * ฟอร์มและ server action ใช้ตัวเดิมทั้งหมด ไม่มี backend ใหม่
 * ยังไม่ล็อกอินก็เปิดอ่านได้ แต่ส่งคำขอได้เฉพาะคนที่ล็อกอิน เพราะต้องรู้ว่าจะเปิดสิทธิ์ให้บัญชีไหน
 */
export default async function ActivationPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  return (
    <>
      <Navbar />
      {/* Navbar เป็น fixed สูง 64px — เว้นที่ให้ ไม่งั้นหัวเรื่องจมใต้แถบ */}
      <main className="container-x max-w-5xl pb-16 pt-28">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[.08em] text-brand">{site.name} ACTIVATION</p>
            <h1 className="display mt-3 text-[length:var(--display-md)]">
              เปิดใช้งาน <span className="text-brand">{site.name} Indicator</span>
            </h1>
          </div>
          <span className="rounded-full border border-brand/40 bg-brand-wash px-3.5 py-1.5 text-xs font-semibold text-brand tnum">
            {ACCESS_DAYS} DAYS ACCESS
          </span>
        </div>
        <p className="mt-4 max-w-xl text-muted">
          รับสิทธิ์ใช้งาน {site.name} บน TradingView เป็นเวลา {ACCESS_DAYS} วัน สำหรับบัญชีที่ผ่านเงื่อนไข {site.name}
        </p>

        <section className="mt-10" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="font-semibold">เริ่มต้นใช้งาน {site.name} ใน 3 ขั้นตอน</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card-surface rounded-2xl p-5">
                <span className="text-xs text-brand tnum">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <BrokerOverviewCard broker={broker} />
            <ConditionsCard />
          </div>

          <section id="apply" className="scroll-mt-24 space-y-4 lg:sticky lg:top-24" aria-label="ส่งคำขอเปิดใช้งาน">
            <p className="text-xs font-semibold tracking-[.08em] text-brand">APPLICATION / {broker.name.toUpperCase()}</p>
            {userId ? <ApplyPanel userId={userId} /> : <LoginPrompt />}
          </section>
        </div>

        <p className="mt-10 text-xs text-muted">
          สอบถามเรื่องบัญชีโบรก ฝาก-ถอน ติดต่อ {broker.name} ทาง LINE {broker.supportLine} · การเปิดบัญชี ฝาก
          และเทรดกับโบรกเป็นการตัดสินใจของผู้ใช้เอง มีความเสี่ยง {site.name} เป็นเครื่องมือประกอบการวิเคราะห์
          ไม่รับประกันผลการซื้อขาย
        </p>
      </main>
      <Footer />
    </>
  );
}

function ConditionsCard() {
  return (
    <section className="card-surface rounded-2xl p-5 sm:p-6" aria-labelledby="conditions-heading">
      <h2 id="conditions-heading" className="font-semibold">
        เงื่อนไขการรับสิทธิ์ {site.name} {ACCESS_DAYS} วัน
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {CONDITIONS.map((c) => (
          <li key={c} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {c}
          </li>
        ))}
      </ul>
      <Link href="/terms" className="mt-5 inline-block text-sm font-semibold hover:text-brand">
        อ่านข้อกำหนดฉบับเต็ม
      </Link>
    </section>
  );
}

/** ยังไม่ล็อกอิน — การ์ดเดียวกับฟอร์ม แต่พาไปล็อกอิน/สมัครแล้วกลับมาที่นี่ */
function LoginPrompt() {
  return (
    <div className="card-surface rounded-2xl p-6">
      <h2 className="font-semibold">ส่งคำขอเปิดใช้งาน {site.name}</h2>
      <p className="mt-1.5 text-sm text-muted">
        เข้าสู่ระบบก่อนส่งคำขอ — ระบบต้องรู้ว่าจะเปิดสิทธิ์ให้บัญชี {site.name} ของใคร ยังไม่มีบัญชีสมัครได้ฟรี
      </p>
      <div className="mt-5 grid gap-2">
        <Button href={`/login?${CALLBACK}`} size="lg" className="w-full">
          เข้าสู่ระบบเพื่อส่งคำขอ
        </Button>
        <Button href={`/register?${CALLBACK}`} variant="outline" size="lg" className="w-full">
          สมัครสมาชิก
        </Button>
      </div>
    </div>
  );
}

/** ล็อกอินแล้ว — ตัดสินด้วยตัวเดียวกับ /account/wisdom ว่าจะโชว์สถานะ หรือฟอร์ม */
async function ApplyPanel({ userId }: { userId: string }) {
  const { user, latest, subscription, waiting, tooEarly } = await getBrokerApplicationView(userId, broker.id);
  const { isActive, daysLeft, sub } = subscription;

  return (
    <>
      {latest && (
        <BrokerApplicationStatus latest={latest} isActive={isActive} periodEnd={sub?.currentPeriodEnd ?? null} />
      )}
      {waiting ? null : tooEarly ? (
        <p className="text-sm text-muted">
          คุณยังมีสิทธิ์ใช้งานอีก {daysLeft} วัน — ขอต่ออายุได้เมื่อเหลือไม่เกิน {BROKER_RENEWAL_WINDOW_DAYS} วัน
        </p>
      ) : (
        <BrokerApplicationForm
          broker={broker.id}
          qvxMinDepositUSD={broker.qvxMinDepositUSD}
          renewal={isActive}
          defaultTvUsername={user?.tradingViewUsername ?? ""}
          defaultEmail={user?.email ?? ""}
        />
      )}
    </>
  );
}
