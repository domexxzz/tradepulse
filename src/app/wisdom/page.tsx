import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Check } from "lucide-react";
import { site } from "@/config/site";
import { BROKERS, DEFAULT_BROKER } from "@/config/brokers";

const broker = BROKERS[DEFAULT_BROKER];

export const metadata: Metadata = {
  title: `รับสิทธิ์ ${site.name} ผ่าน ${broker.name}`,
  description: `เปิดบัญชีเทรดกับ ${broker.fullName} ผ่านลิงก์ของ ${site.name} แล้วรับสิทธิ์ใช้งานอินดิเคเตอร์ ห้องสัญญาณ Telegram และ Discord โดยไม่ต้องจ่ายค่าสมาชิก`,
};

/**
 * ทางที่ 2 ของการได้อินดิเคเตอร์ — เปิดพอร์ตกับโบรกแทนการจ่ายค่าสมาชิก
 *
 * หน้านี้ให้ข้อมูลอย่างเดียว การส่งคำขอทำใน /account/wisdom ซึ่งต้องล็อกอิน
 * เพราะต้องรู้ว่าจะเปิดสิทธิ์ให้บัญชีไหน และต้องมี TradingView username ก่อน
 *
 * ไม่โชว์ปุ่มสมัครถ้ายังไม่ได้ตั้งลิงก์แนะนำของ QVX — ส่งลูกค้าไปลิงก์ทั่วไปแล้ว
 * บัญชีจะไม่นับเป็นของ QVX ลูกค้าทำครบทุกขั้นแต่สุดท้ายไม่ผ่านการตรวจ
 */
export default function WisdomPage() {
  const steps = [
    { title: `เปิดบัญชี ${broker.platform}`, body: `สมัครกับ ${broker.name} ผ่านลิงก์ของ ${site.name} แล้วยืนยันตัวตน (KYC)` },
    { title: `ฝากเงินตั้งแต่ $${broker.qvxMinDepositUSD}`, body: `เงื่อนไขขั้นต่ำของ ${site.name} เพื่อรับสิทธิ์` },
    { title: "ส่งเลขบัญชีเทรด", body: "ทีมงานตรวจในระบบโบรก ผ่านแล้วเปิดสิทธิ์ให้อัตโนมัติ" },
  ];

  const includes = [
    "อินดิเคเตอร์ QVX บน TradingView",
    "ห้องสัญญาณ Telegram M5 · M15 · M30 · H1",
    "ยศ QVX Active ใน Discord",
    "สิทธิ์ 1 เดือน ต่ออายุได้ด้วยบัญชีเดิม",
  ];

  const conditions = [
    `บัญชีต้องเปิดผ่านลิงก์ของ ${site.name} เท่านั้น`,
    `ฝากเงินไม่ต่ำกว่า $${broker.qvxMinDepositUSD} และคงสถานะบัญชีตลอดช่วงที่ใช้สิทธิ์`,
    "หนึ่งบัญชีเทรดใช้รับสิทธิ์ได้หนึ่งคน",
    "ทุกคำขอต้องผ่านการตรวจ การส่งข้อมูลไม่ใช่การอนุมัติทันที",
    "ขอต่ออายุได้เมื่อสิทธิ์เหลือไม่เกิน 3 วัน และต้องผ่านการตรวจอีกครั้ง",
  ];

  return (
    <main className="container-x max-w-4xl py-14">
      <p className="eyebrow">ไม่ต้องจ่ายค่าสมาชิก</p>
      <h1 className="display mt-3 text-[length:var(--display-md)]">
        รับสิทธิ์ {site.name} ผ่าน {broker.name}
      </h1>
      <p className="lede mt-4 max-w-2xl">
        เปิดบัญชีเทรดกับ {broker.fullName} ผ่านลิงก์ของเรา แล้วได้สิทธิ์ใช้งานครบเท่าสมาชิกแบบชำระเงิน
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {broker.signupUrl && (
          <a
            href={broker.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-brand-ink hover:bg-brand-strong"
          >
            เปิดบัญชี {broker.name} <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <Link
          href="/account/wisdom"
          className="inline-flex h-12 items-center rounded-full border border-border-strong px-7 text-sm font-medium hover:border-brand/50 hover:text-brand"
        >
          มีบัญชีแล้ว → ส่งเลขบัญชี
        </Link>
      </div>

      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card-surface rounded-2xl p-5">
            <span className="text-xs text-brand tnum">0{i + 1}</span>
            <h2 className="mt-2 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="card-surface rounded-2xl p-6">
          <h2 className="font-semibold">ได้อะไรบ้าง</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {includes.map((x) => (
              <li key={x} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {x}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface rounded-2xl p-6">
          <h2 className="font-semibold">{broker.fullName}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["แพลตฟอร์ม", broker.platform],
              ["ตลาด", broker.markets],
              ["เลเวอเรจสูงสุด", broker.maxLeverage],
              ["ฝากขั้นต่ำของโบรก", `$${broker.brokerMinDepositUSD}`],
              ["ติดต่อโบรก", `LINE ${broker.supportLine}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <a
            href={broker.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
          >
            เว็บไซต์ {broker.name} <ExternalLink className="h-3 w-3" />
          </a>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-semibold">เงื่อนไข</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {conditions.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          การเปิดบัญชี ฝาก และเทรดกับโบรกเป็นการตัดสินใจของผู้ใช้เอง มีความเสี่ยง ควรศึกษาเงื่อนไขของโบรกก่อนสมัคร
          {site.name} ให้เครื่องมือช่วยวิเคราะห์เท่านั้น ไม่รับประกันผลการเทรด · อยากจ่ายค่าสมาชิกแทน{" "}
          <Link href="/#pricing" className="underline underline-offset-2">ดูแพ็กเกจ</Link>
        </p>
      </section>
    </main>
  );
}
