"use client";
import { useActionState, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { logBrokerEventAction, type BrokerEventState } from "@/lib/actions/broker-event";

const FIELD =
  "w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-brand/60";

/**
 * บันทึกสิ่งที่เห็นในหลังบ้านโบรก — ซ่อนไว้จนกดเปิด ไม่ให้ตารางคิวรก
 * ใช้ตอนยังไม่มีอีเมลแจ้งเตือน หรือตอนอีเมลอ่านเลขบัญชีไม่ออก
 */
export function BrokerEventForm({ tradingAccount }: { tradingAccount: string }) {
  const [open, setOpen] = useState(false);
  // ปิดฟอร์มหลังบันทึกสำเร็จ — ทำใน action เลย (ห้ามเปลี่ยน state ตอน render และการ sync ใน effect ทำให้ render ซ้อน)
  const [state, action, pending] = useActionState<BrokerEventState, FormData>(async (prev, fd) => {
    const result = await logBrokerEventAction(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand"
      >
        <FilePlus2 className="h-3 w-3" />
        บันทึกจากหลังบ้านโบรก
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 w-56 space-y-1.5">
      <input type="hidden" name="tradingAccount" value={tradingAccount} />
      <label className="sr-only" htmlFor={`type-${tradingAccount}`}>
        ชนิด
      </label>
      <select id={`type-${tradingAccount}`} name="type" defaultValue="DEPOSIT" className={FIELD}>
        <option value="SIGNUP">สมัครใต้ลิงก์ QVX</option>
        <option value="DEPOSIT">ฝากเงิน</option>
        <option value="WITHDRAWAL">ถอนเงิน</option>
      </select>
      <input name="amountUSD" inputMode="decimal" placeholder="ยอด USD (สมัครไม่ต้องใส่)" className={FIELD} />
      <input name="accountName" placeholder="ชื่อเจ้าของบัญชีในโบรก" className={FIELD} />
      <input name="accountEmail" type="email" placeholder="อีเมลในโบรก" className={FIELD} />
      <label className="sr-only" htmlFor={`date-${tradingAccount}`}>
        วันที่
      </label>
      <input id={`date-${tradingAccount}`} name="occurredAt" type="date" className={FIELD} />
      {state.error && <p className="text-[11px] text-down">{state.error}</p>}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-[11px] font-semibold text-brand-ink hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-2 py-1.5 text-[11px] hover:bg-surface-2"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
