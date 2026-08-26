"use client";
import { useActionState } from "react";
import { MailX, CheckCircle2 } from "lucide-react";
import { unsubscribeByToken, type UnsubState } from "@/lib/actions/newsletter";

export function UnsubscribeForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<UnsubState, FormData>(unsubscribeByToken, {});

  if (state.ok) {
    return (
      <>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">ยกเลิกเรียบร้อยแล้ว</h1>
        <p className="mt-2 text-sm text-muted">เราจะไม่ส่งข่าวสารไปที่ {email} อีก</p>
      </>
    );
  }

  return (
    <>
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted">
        <MailX className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold">ยกเลิกรับข่าวสาร</h1>
      <p className="mt-2 text-sm text-muted">
        ยืนยันว่าไม่ต้องการรับข่าวสารที่ {email} แล้วใช่ไหม
      </p>

      {state.error && (
        <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}

      <form action={action} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
        </button>
      </form>
    </>
  );
}
