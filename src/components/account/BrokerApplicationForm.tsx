"use client";
import { useActionState, useState } from "react";
import { submitBrokerApplicationAction, type BrokerFormState } from "@/lib/actions/broker";

export function BrokerApplicationForm({
  broker,
  qvxMinDepositUSD,
  renewal,
}: {
  broker: string;
  qvxMinDepositUSD: number;
  renewal: boolean;
}) {
  const [state, action, pending] = useActionState<BrokerFormState, FormData>(
    submitBrokerApplicationAction,
    {}
  );
  // คุมค่าไว้เอง — React 19 ล้างช่องในฟอร์มหลังส่งทุกครั้ง พอโดนเตือน (ลืมติ๊ก / เลขผิด)
  // ลูกค้าต้องพิมพ์เลขบัญชีใหม่หมด ถ้าคุมด้วย state ค่าจะอยู่รอดข้ามการส่ง
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

  return (
    <form action={action} className="card-surface space-y-4 rounded-2xl p-6">
      <input type="hidden" name="broker" value={broker} />

      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}

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
          className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm tnum outline-none placeholder:text-muted focus:border-brand/60"
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
        {pending ? "กำลังส่ง…" : renewal ? "ส่งคำขอต่ออายุ" : "ส่งคำขอรับสิทธิ์"}
      </button>
    </form>
  );
}
