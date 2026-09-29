"use client";
import { useActionState, useState } from "react";
import { submitBrokerApplicationAction, type BrokerFormState } from "@/lib/actions/broker";

export function BrokerApplicationForm({
  broker,
  qvxMinDepositUSD,
  renewal,
  defaultTvUsername,
  defaultEmail,
}: {
  broker: string;
  qvxMinDepositUSD: number;
  renewal: boolean;
  /** ชื่อที่เคยกรอกไว้ในบัญชี — คนที่ขอต่ออายุจะได้ไม่ต้องพิมพ์ซ้ำ */
  defaultTvUsername: string;
  /** อีเมลที่สมัคร QVX — เติมไว้ให้ก่อน แก้ได้ถ้าเปิดบัญชีโบรกด้วยอีเมลอื่น */
  defaultEmail: string;
}) {
  const [state, action, pending] = useActionState<BrokerFormState, FormData>(
    submitBrokerApplicationAction,
    {}
  );
  // คุมค่าไว้เอง — React 19 ล้างช่องในฟอร์มหลังส่งทุกครั้ง พอโดนเตือน (ลืมติ๊ก / เลขผิด)
  // ลูกค้าต้องพิมพ์ใหม่หมด ถ้าคุมด้วย state ค่าจะอยู่รอดข้ามการส่ง
  const [tvUsername, setTvUsername] = useState(defaultTvUsername);
  const [email, setEmail] = useState(defaultEmail);
  const [account, setAccount] = useState("");
  const [accepted, setAccepted] = useState(false);

  if (state.ok) {
    return (
      <div className="card-surface rounded-2xl border border-up/30 p-6">
        <h2 className="font-semibold text-up">ส่งคำขอแล้ว</h2>
        <p className="mt-1.5 text-sm text-muted">
          ทีมงานจะตรวจบัญชีในระบบโบรก ผ่านแล้วระบบเปิดสิทธิ์อินดิเคเตอร์ ห้อง Telegram และยศ Discord ให้อัตโนมัติ
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60";

  return (
    <form action={action} className="card-surface space-y-4 rounded-2xl p-6">
      <input type="hidden" name="broker" value={broker} />

      <h2 className="font-semibold">ส่งคำขอเปิดใช้งาน QVX</h2>

      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">TradingView Username</span>
        <input
          name="tvUsername"
          value={tvUsername}
          onChange={(e) => setTvUsername(e.target.value)}
          autoComplete="off"
          required
          placeholder="เช่น QVXOfficial"
          className={field}
        />
        <span className="mt-1.5 block text-xs text-muted">
          ชื่อผู้ใช้ที่ระบบจะเพิ่มสิทธิ์อินดิเคเตอร์ให้ — ดูวิธีหาได้ที่หน้าแรก หัวข้อเริ่มต้นการใช้งาน
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">อีเมลที่ใช้เปิดบัญชีโบรก</span>
        <input
          name="brokerEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={field}
        />
        <span className="mt-1.5 block text-xs text-muted">
          ถ้าเปิดบัญชีโบรกด้วยอีเมลคนละตัวกับที่สมัคร QVX ให้แก้เป็นอีเมลที่ใช้กับโบรก
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">เลขบัญชีเทรด MT5</span>
        <input
          name="tradingAccount"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder="ตัวเลขล้วน เช่น 12345678"
          className={`${field} tnum`}
        />
        <span className="mt-1.5 block text-xs text-muted">
          เลขที่ใช้ล็อกอิน MT5 — ดูได้จากข้อความ &quot;การเปิดบัญชีที่ประสบความสำเร็จ&quot; ในเมนูการแจ้งเตือนของโบรก
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="accept"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 accent-[var(--brand)]"
        />
        <span>
          บัญชีนี้เปิดผ่านลิงก์ของ QVX และฝากเงินแล้วไม่ต่ำกว่า ${qvxMinDepositUSD} · เข้าใจว่าสิทธิ์มีอายุ 1 เดือน
          และต้องผ่านการตรวจสอบก่อนเปิดใช้งาน
        </span>
      </label>

      <button
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : renewal ? "ส่งคำขอต่ออายุ" : "ส่งคำขอเปิดใช้งาน QVX"}
      </button>
    </form>
  );
}
