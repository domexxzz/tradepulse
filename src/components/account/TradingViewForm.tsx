"use client";
import { useActionState } from "react";
import { updateTradingView, type TvState } from "@/lib/actions/account";

export function TradingViewForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<TvState, FormData>(updateTradingView, {});
  return (
    <form action={action} className="card-surface rounded-2xl p-6 space-y-4">
      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-up/30 bg-up/10 px-3.5 py-2.5 text-sm text-up">บันทึกเรียบร้อย</div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">TradingView Username</span>
        <div className="flex items-center rounded-lg border border-border bg-surface-2 px-3.5 focus-within:border-brand/60">
          <span className="text-muted">@</span>
          <input
            name="tvUsername"
            defaultValue={current}
            placeholder="your_username"
            className="w-full bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted"
          />
        </div>
      </label>
      <button
        disabled={pending}
        className="h-11 rounded-full bg-gradient-to-r from-brand-strong to-brand-deep px-6 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
