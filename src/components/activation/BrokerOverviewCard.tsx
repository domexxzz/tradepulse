import Link from "next/link";
import { ExternalLink, Gift } from "lucide-react";
import type { Broker } from "@/config/brokers";
import { site } from "@/config/site";

/**
 * การ์ดโบรกในหน้า /activation — ทุกตัวเลขมาจาก config/brokers.ts
 *
 * ม็อกอัปมีคะแนนรีวิว จำนวนผู้ใช้ และตารางโบนัสพร้อมเพดาน ซึ่งไม่มีที่มาในคู่มือ
 * จึงใช้สเปกบัญชีจริง (แพลตฟอร์ม · เลเวอเรจ · ขั้นต่ำรับสิทธิ์) ในช่องเดียวกันแทน
 * ตัวเลขของบุคคลที่สามที่เราตรวจไม่ได้ ขึ้นหน้าเว็บเราแล้วกลายเป็นเราเป็นคนอ้าง
 */
export function BrokerOverviewCard({ broker }: { broker: Broker }) {
  const specs = [
    { value: broker.platform, label: "แพลตฟอร์ม" },
    { value: broker.maxLeverage, label: "เลเวอเรจสูงสุด" },
    { value: `$${broker.qvxMinDepositUSD}`, label: `ขั้นต่ำรับสิทธิ์ ${site.name}` },
  ];

  return (
    <section className="card-surface rounded-2xl p-5 sm:p-6" aria-labelledby="broker-name">
      <div className="flex items-center gap-4">
        {/* ไม่มีไฟล์โลโก้โบรกในเว็บ — ใช้อักษรย่อแทน ไม่ไปดึงโลโก้จากเว็บโบรกมาใช้เอง */}
        <span
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-border-strong bg-surface-2 font-display text-2xl font-bold text-brand"
        >
          {broker.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h2 id="broker-name" className="font-display text-xl font-bold">{broker.name}</h2>
          <p className="mt-0.5 text-sm text-muted">{broker.markets}</p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm text-muted">Standard · เงินฝากเริ่มต้นของโบรก</p>
        <p className="font-display text-3xl font-bold text-brand tnum">${broker.brokerMinDepositUSD}</p>
      </div>

      {/* dt ต้องมาก่อน dd ตามสเปก HTML — กลับลำดับด้วย CSS ให้ตัวเลขอยู่บน */}
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {specs.map((s) => (
          <div key={s.label} className="card-soft flex flex-col-reverse rounded-lg px-3 py-2.5">
            <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
            <dd className="font-semibold text-brand tnum">{s.value}</dd>
          </div>
        ))}
      </dl>

      {broker.promotions.length > 0 && (
        <div className="mt-5 rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-brand" /> สิทธิประโยชน์ตามโปรโมชันของโบรก
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {broker.promotions.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="text-brand">·</span> {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            เป็นเงื่อนไขของ {broker.name} ไม่ใช่ของ {site.name} อาจเปลี่ยนแปลงได้ — ตรวจสอบกับโบรกก่อนสมัคร
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link
          href="/wisdom"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border-strong px-5 text-sm font-medium hover:border-brand/50 hover:text-brand"
        >
          อ่านรายละเอียด {broker.name}
        </Link>
        {broker.signupUrl ? (
          <a
            href={broker.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-strong"
          >
            เปิดบัญชีเริ่มต้นใช้งาน <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="self-center text-sm text-muted">ติดต่อทีมงานเพื่อรับลิงก์สมัคร</span>
        )}
        <a
          href={broker.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border px-5 text-sm hover:bg-surface-2 sm:col-span-2"
        >
          ดูเว็บไซต์ {broker.name} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ข้อที่พลาดแล้วเสียเวลาที่สุด — สมัครผ่านลิงก์ทั่วไปแล้วต้องเปิดบัญชีใหม่ทั้งใบ */}
      <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed">
        ต้องเปิดบัญชีผ่านปุ่ม &quot;เปิดบัญชีเริ่มต้นใช้งาน&quot; ด้านบนเท่านั้น บัญชีที่สมัครผ่านลิงก์อื่นหรือสมัครไว้ก่อนแล้ว
        จะไม่นับเป็นบัญชีของ {site.name} และไม่ผ่านการตรวจสอบ
      </p>

      <p className="mt-4 text-sm text-muted">
        หลังจากเปิดบัญชีและผ่านเงื่อนไขแล้ว กลับมาหน้านี้เพื่อส่งคำขอเปิดใช้งาน {site.name}
      </p>
      <a href="#apply" className="mt-2 inline-block text-sm font-semibold hover:text-brand">
        มีบัญชีแล้ว → กรอกข้อมูล
      </a>
    </section>
  );
}
