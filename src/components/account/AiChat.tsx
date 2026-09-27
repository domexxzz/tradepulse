"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { AI_MAX_MESSAGE_CHARS } from "@/config/ai";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Usage = { used: number; limit: number; remaining: number; resetAt: string };

const EXAMPLES = ["CHoCH คืออะไร", "อธิบาย Order Block", "ดู Trend ต่าง Timeframe ยังไง", "วิธีใช้อินดิเคเตอร์ QVX"];

/**
 * จัดรูปคำตอบแบบเบา ๆ — หัวข้อ (#) · รายการ (- หรือ 1.) · ตัวหนา (**)
 * ประกอบเป็น element ของ React เท่านั้น ไม่ใช้ innerHTML — คำตอบมาจากโมเดล
 * ซึ่งอาจยกข้อความจากข้อมูลภายนอกมา จะเรนเดอร์เป็น HTML ไม่ได้
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function Formatted({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && "\n"}
                {/^#{1,4}\s+/.test(l) ? <strong>{inline(l.replace(/^#{1,4}\s+/, ""))}</strong> : inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function AiChat({
  conversationId,
  initialMessages,
  initialUsage,
  available,
  notFound,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  initialUsage: Usage;
  available: boolean;
  notFound: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [usage, setUsage] = useState<Usage>(initialUsage);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(notFound ? "ไม่พบบทสนทนานี้ — เริ่มแชตใหม่ได้เลย" : null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const outOfQuota = usage.remaining <= 0;
  const disabled = !available || outOfQuota || pending;

  async function send(text: string) {
    const message = text.trim();
    if (!message || disabled) return;
    setError(null);
    setPending(true);
    setDraft("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: message }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // คืนข้อความที่พิมพ์ไว้ ไม่ต้องพิมพ์ใหม่
        setMessages((m) => m.slice(0, -1));
        setDraft(message);
        setError(data.message ?? "ส่งไม่สำเร็จ ลองอีกครั้ง");
        if (data.error === "AI_QUOTA_EXHAUSTED") setUsage((u) => ({ ...u, remaining: 0 }));
        return;
      }
      setMessages((m) => [...m, { id: `local-${Date.now()}-a`, role: "assistant", content: data.answer }]);
      setUsage(data.usage);
      // แชตแรก — ย้ายไปที่อยู่ของแชตนั้น ให้แถบประวัติขึ้นและรีเฟรชแล้วไม่หาย
      if (!conversationId) router.replace(`/account/ai?c=${data.conversationId}`, { scroll: false });
    } catch {
      setMessages((m) => m.slice(0, -1));
      setDraft(message);
      setError("เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  const usedPct = Math.min(100, (usage.used / usage.limit) * 100);
  const resetDate = new Date(usage.resetAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

  return (
    <section className="card-surface flex min-h-[60vh] flex-col rounded-2xl">
      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {!available && (
          <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
            QVX AI กำลังเตรียมเปิดให้บริการ — ยังส่งคำถามไม่ได้ในตอนนี้
          </p>
        )}

        {messages.length === 0 && available && (
          <div className="space-y-3">
            <p className="text-sm text-muted">ลองถามได้เลย เช่น</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={disabled}
                  onClick={() => send(q)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand/15 px-4 py-2.5 text-sm">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] text-sm leading-relaxed">
              <span className="mb-1 block text-xs font-semibold text-brand">QVX AI</span>
              <Formatted text={m.content} />
            </div>
          )
        )}

        {pending && (
          <div className="text-sm text-muted">
            <span className="mb-1 block text-xs font-semibold text-brand">QVX AI</span>
            <span className="animate-pulse motion-reduce:animate-none">กำลังคิด…</span>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="space-y-2 border-t border-border p-4">
        {error && (
          <p role="alert" className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2 text-sm text-down">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="ai-message" className="sr-only">
            คำถาม
          </label>
          <textarea
            id="ai-message"
            rows={2}
            maxLength={AI_MAX_MESSAGE_CHARS}
            value={draft}
            disabled={!available || outOfQuota}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter ส่ง · Shift+Enter ขึ้นบรรทัด · ระหว่างพิมพ์ภาษาไทยด้วย IME ห้ามส่ง
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder={outOfQuota ? `ครบโควตาเดือนนี้แล้ว เริ่มใหม่ ${resetDate}` : "พิมพ์คำถาม… (Enter ส่ง · Shift+Enter ขึ้นบรรทัด)"}
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            aria-label="ส่งคำถาม"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${usedPct}%` }} />
          </div>
          <span className="tnum">
            เหลือ {usage.remaining}/{usage.limit} คำถาม · เริ่มใหม่ {resetDate}
          </span>
        </div>
      </div>
    </section>
  );
}
