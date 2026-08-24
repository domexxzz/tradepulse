"use client";
import { useActionState } from "react";
import { linkDiscord, type DiscordLinkState } from "@/lib/actions/discord";
import { DiscordIcon } from "@/components/common/DiscordIcon";

export function DiscordLinkForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<DiscordLinkState, FormData>(linkDiscord, {});

  return (
    <form action={action} className="card-surface space-y-4 rounded-2xl p-6">
      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}
      {state.ok && state.note && (
        <div className="rounded-lg border border-up/30 bg-up/10 px-3.5 py-2.5 text-sm text-up">
          {state.note}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">ชื่อผู้ใช้ Discord</span>
        <input
          name="discord"
          defaultValue={current ?? ""}
          placeholder="เช่น tradepulse_user"
          className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
        <span className="mt-1.5 block text-xs text-muted">
          กรอกชื่อผู้ใช้ (ไม่ใช่ชื่อเล่นที่ตั้งในเซิร์ฟเวอร์) หรือจะวาง Discord User ID ก็ได้
        </span>
      </label>

      <button
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#5865F2] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <DiscordIcon className="h-4 w-4" />
        {pending ? "กำลังตรวจสอบ…" : current ? "อัปเดตบัญชี Discord" : "ผูกบัญชี Discord"}
      </button>
    </form>
  );
}
