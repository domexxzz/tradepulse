"use client";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Square, Activity, BookOpen, Cpu, Newspaper } from "lucide-react";
import { AI_MAX_MESSAGE_CHARS } from "@/config/ai";

type Message = { id: string; role: "user" | "assistant"; content: string; sources?: string[]; streaming?: boolean; failed?: boolean };
type Usage = { used: number; limit: number; remaining: number; resetAt: string };
type Live = { symbol: string; chartTf: string; receivedAt: string };

const EXAMPLES = [
  "ทองตอนนี้ M15 เป็นยังไง",
  "ICT Buy ต่างจาก Buy Scalping ยังไง",
  "ชน TP1 แล้วต้องทำอะไรต่อ",
  "เปิดบัญชี Wisdom รับสิทธิ์ยังไง",
];

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

/**
 * นาฬิกาฝั่งเบราว์เซอร์ เดินทุก 30 วินาที — ฝั่งเซิร์ฟเวอร์คืน null
 * ถ้าคำนวณ "กี่นาทีที่แล้ว" ตอน render ตรง ๆ เซิร์ฟเวอร์กับเบราว์เซอร์ได้คนละค่า (hydration mismatch)
 */
const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
};
const clockNow = () => Math.floor(Date.now() / 30_000) * 30_000;

function TimeAgo({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribeClock, clockNow, () => null);
  if (now === null) return <>ล่าสุด</>;
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return <>{mins < 1 ? "เมื่อสักครู่" : `${mins} นาทีที่แล้ว`}</>;
}
const tfLabel = (tf: string) => (/^\d+$/.test(tf) ? (Number(tf) >= 60 ? `H${Number(tf) / 60}` : `M${tf}`) : tf);

export function AiChat({
  conversationId,
  initialMessages,
  initialUsage,
  available,
  engine,
  live,
  notFound,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  initialUsage: Usage;
  available: boolean;
  engine: { local: boolean; cloud: boolean };
  live: Live[];
  notFound: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [usage, setUsage] = useState<Usage>(initialUsage);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [markets, setMarkets] = useState<Live[]>(live);
  const [newsUsed, setNewsUsed] = useState(0);
  const [error, setError] = useState<string | null>(notFound ? "ไม่พบบทสนทนานี้ — เริ่มแชตใหม่ได้เลย" : null);
  const bottom = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const outOfQuota = usage.remaining <= 0;
  const disabled = !available || outOfQuota || pending;

  const patchLast = (fn: (m: Message) => Message) =>
    setMessages((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1])] : all));

  async function send(text: string) {
    const message = text.trim();
    if (!message || disabled) return;
    setError(null);
    setPending(true);
    setDraft("");
    const stamp = ++seq.current;
    // ขึ้นกล่องคำตอบทันที — เครื่องบ้านโหลดโมเดลครั้งแรกใช้หลายวินาที ลูกค้าต้องเห็นว่ากำลังทำงาน
    setMessages((m) => [
      ...m,
      { id: `u-${stamp}`, role: "user", content: message },
      { id: `a-${stamp}`, role: "assistant", content: "", streaming: true },
    ]);
    const dropPair = () => setMessages((m) => m.filter((x) => x.id !== `a-${stamp}` && x.id !== `u-${stamp}`));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let gotText = false;
    let finished = false;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
        signal: ctrl.signal,
      });

      // ผิดตั้งแต่ก่อนเริ่ม — เป็น JSON ธรรมดา
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        dropPair();
        setDraft(message);
        setError(data.message ?? "ส่งไม่สำเร็จ ลองอีกครั้ง");
        if (data.error === "AI_QUOTA_EXHAUSTED") setUsage((u) => ({ ...u, remaining: 0 }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "meta") {
            patchLast((a) => ({ ...a, sources: ev.sources }));
            if (Array.isArray(ev.live)) setMarkets(ev.live);
            setNewsUsed(Number(ev.news) || 0);
          } else if (ev.t === "d") {
            gotText = true;
            patchLast((a) => ({ ...a, content: a.content + ev.v }));
          } else if (ev.t === "done") {
            finished = true;
            patchLast((a) => ({ ...a, streaming: false }));
            setUsage(ev.usage);
            // แชตแรก — ย้ายไปที่อยู่ของแชตนั้น ให้แถบประวัติขึ้นและรีเฟรชแล้วไม่หาย
            if (!conversationId) router.replace(`/account/ai?c=${ev.conversationId}`, { scroll: false });
          } else if (ev.t === "error") {
            finished = true;
            setError(ev.message);
            if (ev.partial) patchLast((a) => ({ ...a, streaming: false, failed: true }));
            else {
              // ยังไม่ได้สักคำ — คืนคำถามให้แก้ส่งใหม่ ไม่ต้องพิมพ์ซ้ำ
              dropPair();
              setDraft(message);
            }
          }
        }
      }
      if (!finished) throw new Error("stream_closed");
    } catch (e) {
      const stopped = (e as Error)?.name === "AbortError";
      if (gotText) {
        patchLast((a) => ({ ...a, streaming: false, failed: !stopped }));
        if (!stopped) setError("การเชื่อมต่อหลุดระหว่างตอบ — คำถามนี้ไม่ถูกนับโควตา");
      } else {
        dropPair();
        setDraft(message);
        if (!stopped) setError("เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }

  const usedPct = Math.min(100, (usage.used / usage.limit) * 100);
  const resetDate = new Date(usage.resetAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  const liveMain = markets[0];

  return (
    <section className="card-surface flex min-h-[64vh] flex-col overflow-hidden rounded-2xl">
      {/* แถบสถานะ — ลูกค้าเห็นว่า AI เห็นกราฟสดอยู่ไหม และระบบพร้อมไหม */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs">
        {liveMain ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-up/10 px-2.5 py-1 font-medium text-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
            </span>
            กราฟสด {liveMain.symbol} · {tfLabel(liveMain.chartTf)} · <TimeAgo iso={liveMain.receivedAt} />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            <Activity className="h-3.5 w-3.5" />
            ยังไม่มีข้อมูลกราฟสด — ตอบจากความรู้อย่างเดียว
          </span>
        )}
        {newsUsed > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            <Newspaper className="h-3.5 w-3.5" />
            อ่านข่าวล่าสุด {newsUsed} ข่าว
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
          <Cpu className="h-3.5 w-3.5" />
          {available ? (engine.local ? (engine.cloud ? "พร้อม · มีระบบสำรอง" : "พร้อมใช้งาน") : "พร้อม · ระบบสำรอง") : "ยังไม่เปิดให้บริการ"}
        </span>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
        {!available && (
          <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
            QVX AI กำลังเตรียมเปิดให้บริการ — ยังส่งคำถามไม่ได้ในตอนนี้
          </p>
        )}

        {messages.length === 0 && available && (
          <div className="space-y-3 py-6">
            <p className="text-sm text-muted">ถามเรื่องกราฟตอนนี้ วิธีใช้ QVX หรือแนวคิด SMC / ICT ได้เลย</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={disabled}
                  onClick={() => send(q)}
                  className="rounded-xl border border-border px-3.5 py-2.5 text-left text-sm transition-colors hover:border-brand/50 hover:bg-surface-2 disabled:opacity-50"
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
              {m.content ? (
                <Formatted text={m.content} />
              ) : (
                <span className="animate-pulse text-muted motion-reduce:animate-none">กำลังอ่านกราฟและคลังความรู้…</span>
              )}
              {m.streaming && m.content && (
                <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-brand motion-reduce:animate-none" aria-hidden />
              )}
              {m.failed && <span className="mt-1 block text-xs text-down">คำตอบนี้ไม่ครบ — ลองถามใหม่ได้ (ไม่ถูกนับโควตา)</span>}
              {!m.streaming && m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <BookOpen className="h-3.5 w-3.5" />
                  {m.sources.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full border border-border px-2 py-0.5">
                      {/* ชื่อหัวข้อเต็มยาว เอาแค่ส่วนหน้า "Entry / SL / TP1 / TP2 และ Plan #" */}
                      {s.replace(/^FAQ: /, "").split(/ — | \(/)[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
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
          {pending ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="หยุดตอบ"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground transition-colors hover:bg-surface-3"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !draft.trim()}
              aria-label="ส่งคำถาม"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
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
