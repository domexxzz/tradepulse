"use client";

import { useRef, useState } from "react";
import { Send, Square, Cloud, HardDrive, Sparkles } from "lucide-react";

/**
 * ห้องถาม AI ของแอดมิน
 *
 * ตั้งใจให้เบากว่าแชตสมาชิก: ไม่มีประวัติบทสนทนา ไม่มีโควตา ถามครั้งเดียวจบครั้งเดียว
 * เพราะคำถามแอดมินเป็น "ขอสรุปสถานะตอนนี้" ไม่ใช่การคุยต่อเนื่อง และข้อมูลจะเก่า
 * ทันทีที่มีสลิปเข้ามาใหม่ — เก็บบทสนทนาไว้มีแต่จะทำให้อ่านตัวเลขเก่าแล้วเข้าใจผิด
 */

const SUGGESTIONS = [
  "สรุปสถานะตอนนี้ให้หน่อย",
  "มีอะไรค้างที่ต้องรีบทำไหม",
  "เดือนนี้รายได้เท่าไหร่",
  "ใครใกล้หมดอายุบ้าง",
];

type Msg = { role: "user" | "assistant"; content: string };

function Rendered({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
        if (bullets.length === lines.length && bullets.length > 0) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{bold(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {bold(block)}
          </p>
        );
      })}
    </div>
  );
}

function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function AdminAiChat({ available }: { available: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<"local" | "cloud" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || pending || !available) return;

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setPending(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "เรียก AI ไม่สำเร็จ");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { t: string; v?: string; source?: "local" | "cloud"; message?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "meta" && ev.source) setSource(ev.source);
          else if (ev.t === "d" && ev.v) {
            const chunk = ev.v;
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
              return next;
            });
          } else if (ev.t === "error") setError(ev.message ?? "ตอบไม่สำเร็จ");
        }
      }
    } catch (e) {
      // กดหยุดเองไม่ใช่ข้อผิดพลาด ไม่ต้องขึ้นแถบแดง
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setPending(false);
      abortRef.current = null;
      // ตอบไม่ทันสักตัวอักษร — เอาฟองเปล่าออก ไม่ให้ค้างเป็นช่องว่าง
      setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -1) : m));
    }
  }

  return (
    <div className="card-surface flex min-h-[60vh] flex-col overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          ผู้ช่วยแอดมิน
        </span>
        {source && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            {source === "local" ? <HardDrive className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
            {source === "local" ? "เครื่องบ้าน" : "คลาวด์สำรอง"}
          </span>
        )}
        <span className="text-muted">ตอบจากข้อมูลจริงในระบบ ณ วินาทีที่ถาม · ไม่เก็บบทสนทนา</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">ถามอะไรก็ได้เกี่ยวกับสถานะธุรกิจ — ลองกดคำถามพวกนี้ดู</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  disabled={!available || pending}
                  className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs hover:border-up/40 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-up/15 px-3.5 py-2 text-sm">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="max-w-[92%]">
              {m.content ? <Rendered text={m.content} /> : <span className="text-sm text-muted">กำลังคิด…</span>}
            </div>
          )
        )}

        {error && <p className="rounded-lg bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={available ? "ถามสถานะธุรกิจ…" : "AI ยังไม่เปิดให้บริการ"}
          disabled={!available || pending}
          className="flex-1 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-up/40 disabled:opacity-50"
        />
        {pending ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-xl border border-border px-3 py-2.5 text-sm"
            aria-label="หยุด"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!available || !input.trim()}
            className="rounded-xl bg-up px-3.5 py-2.5 text-sm text-black disabled:opacity-40"
            aria-label="ส่ง"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}
