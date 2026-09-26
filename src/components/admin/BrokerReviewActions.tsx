"use client";
import { useActionState, useState } from "react";
import {
  approveBrokerAction,
  rejectBrokerAction,
  type AdminBrokerState,
} from "@/lib/actions/broker";
import { BROKER_REJECTION_REASONS } from "@/config/brokers";

export function BrokerReviewActions({ applicationId }: { applicationId: string }) {
  const [approveState, approve, approving] = useActionState<AdminBrokerState, FormData>(approveBrokerAction, {});
  const [rejectState, reject, rejecting] = useActionState<AdminBrokerState, FormData>(rejectBrokerAction, {});
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const error = approveState.error ?? rejectState.error;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <form action={approve}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <button
            disabled={approving || rejecting}
            className="rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25 disabled:opacity-50"
          >
            {approving ? "กำลังเปิดสิทธิ์…" : "อนุมัติ"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={approving || rejecting}
          className="rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25 disabled:opacity-50"
        >
          ปฏิเสธ
        </button>
      </div>

      {open && (
        <form action={reject} className="w-72 space-y-2 rounded-xl border border-border bg-surface-2 p-3 text-left">
          <input type="hidden" name="applicationId" value={applicationId} />
          <select
            name="reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs"
          >
            <option value="" disabled>เลือกเหตุผล</option>
            {Object.entries(BROKER_REJECTION_REASONS).map(([code, label]) => (
              <option key={code} value={code}>{label.split(" — ")[0]}</option>
            ))}
          </select>
          <textarea
            name="note"
            rows={2}
            required={reason === "OTHER"}
            placeholder={reason === "OTHER" ? "ข้อความถึงลูกค้า (จำเป็น)" : "ข้อความเพิ่มเติมถึงลูกค้า (ไม่บังคับ)"}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs"
          />
          <button
            disabled={rejecting}
            className="w-full rounded-full bg-down/20 py-1.5 text-xs font-medium text-down hover:bg-down/30 disabled:opacity-50"
          >
            {rejecting ? "กำลังบันทึก…" : "ยืนยันปฏิเสธ"}
          </button>
        </form>
      )}

      {error && <p className="max-w-72 text-right text-xs text-down">{error}</p>}
    </div>
  );
}
