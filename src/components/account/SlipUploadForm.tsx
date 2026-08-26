"use client";
/* eslint-disable @next/next/no-img-element */
import { useActionState, useState } from "react";
import { submitSlip, type SlipState } from "@/lib/actions/payment";

export function SlipUploadForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<SlipState, FormData>(submitSlip, {});
  const [preview, setPreview] = useState<string>("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  if (state.ok) {
    return (
      <div className="rounded-lg border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
        {state.note ?? "ส่งสลิปเรียบร้อย รอทีมงานตรวจสอบ"}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{state.error}</div>}
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="slip" value={preview} />
      <input
        type="file"
        accept="image/*"
        onChange={onFile}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink hover:file:bg-brand-strong"
      />
      {preview && <img src={preview} alt="ตัวอย่างสลิป" className="max-h-64 rounded-xl border border-border" />}
      <button
        type="submit"
        disabled={pending || !preview}
        className="h-11 w-full rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : "ส่งสลิปยืนยันการโอน"}
      </button>
    </form>
  );
}
