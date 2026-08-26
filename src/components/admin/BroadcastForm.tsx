"use client";
import { useActionState } from "react";
import { Send, TriangleAlert } from "lucide-react";
import { sendBroadcast, type BroadcastState } from "@/lib/actions/newsletter";

export function BroadcastForm({ recipients }: { recipients: number }) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(sendBroadcast, {});

  return (
    <form action={action} className="card-surface space-y-4 rounded-2xl p-6">
      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-up/30 bg-up/10 px-3.5 py-2.5 text-sm text-up">
          ส่งแล้ว {state.sent} ฉบับ
          {state.failed ? ` · ส่งไม่สำเร็จ ${state.failed} ฉบับ` : ""}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">หัวข้ออีเมล</span>
        <input
          name="subject"
          maxLength={150}
          placeholder="เช่น อัปเดตฟีเจอร์ใหม่ประจำเดือน"
          className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">เนื้อหา</span>
        <textarea
          name="body"
          rows={10}
          maxLength={5000}
          placeholder={"เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่\n\nระบบจะใส่ลิงก์ยกเลิกรับข่าวสารให้อัตโนมัติทุกฉบับ"}
          className="w-full resize-y rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
        <span className="mt-1 block text-xs text-muted">
          พิมพ์เป็นข้อความธรรมดา ระบบจัดรูปแบบเป็นอีเมลให้เอง (HTML จะถูกตัดทิ้งเพื่อความปลอดภัย)
        </span>
      </label>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
          <TriangleAlert className="h-4 w-4" /> ส่งแล้วเรียกคืนไม่ได้
        </p>
        <p className="mt-1.5 text-xs text-muted">
          อีเมลจะถูกส่งถึงผู้รับ {recipients} คนทันทีที่กดปุ่ม พิมพ์ <b className="text-foreground">SEND</b> เพื่อยืนยัน
        </p>
        <input
          name="confirm"
          autoComplete="off"
          placeholder="SEND"
          className="mt-3 w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
      </div>

      <button
        disabled={pending || recipients === 0}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-background transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {pending ? "กำลังส่ง…" : `ส่งถึงผู้รับ ${recipients} คน`}
      </button>
    </form>
  );
}
