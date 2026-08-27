"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { site, hasLineContact, hasDiscord, discordInviteUrl } from "@/config/site";
import { DiscordIcon } from "@/components/common/DiscordIcon";

type Msg = { role: "bot" | "user"; text: string };

const GREETING =
  "สวัสดีครับ 👋 ผมเป็นบอทช่วยตอบของ QVX ถามเรื่องราคา การติดตั้ง หรือการใช้งานได้เลย — ถ้าอยากคุยกับทีมงานจริง กดปุ่ม LINE ด้านล่างได้ครับ";

const RULES: { k: string[]; a: string }[] = [
  { k: ["ราคา", "กี่บาท", "จ่าย", "สมัคร", "แพ็ก", "แพ็ค"], a: "เลือกแพ็กเกจได้ในหน้า ราคา ครับ มีรายเดือน/3เดือน/6เดือน/รายปี — ชำระผ่าน PromptPay (สแกน QR แล้วแนบสลิป) เปิดสิทธิ์ให้หลังตรวจสอบครับ" },
  { k: ["tradingview", "ติดตั้ง", "เพิ่ม", "ใช้ยังไง", "เริ่ม"], a: "หลังสมัคร แจ้ง TradingView username ในหน้าบัญชี ทีมงานจะเพิ่มสิทธิ์อินดิเคเตอร์ (invite-only) ให้ แล้วเพิ่มเข้ากราฟได้เลยครับ" },
  { k: ["ยกเลิก", "คืนเงิน", "refund"], a: "ยกเลิกได้ตามเงื่อนไขแพ็กเกจครับ รายละเอียดการคืนเงินดูได้ที่หน้านโยบายการคืนเงิน หรือสอบถามทีมงานผ่าน LINE ได้เลย" },
  { k: ["repaint", "รีเพนต์", "แม่น"], a: "สัญญาณออกแบบให้ไม่ Repaint ครับ เมื่อเกิดสัญญาณแล้วใช้อ้างอิงได้ โดยยึดแท่งที่ปิดแล้ว — แต่การเทรดมีความเสี่ยง ไม่การันตีกำไรนะครับ" },
  { k: ["timeframe", "ไทม์เฟรม", "tf", "นาที"], a: "ใช้ได้ทุกไทม์เฟรมครับ แนะนำ M15 ขึ้นไปสำหรับการวางแผนที่ชัดเจน และดูภาพใหญ่จาก TF สูงร่วมด้วย" },
  { k: ["สินทรัพย์", "ทอง", "xauusd", "forex", "crypto", "หุ้น", "คู่"], a: "ออกแบบมาเพื่อทองคำ (XAUUSD) เป็นหลัก และใช้กับ Forex/Crypto/หุ้นได้ เพราะทำงานกับกราฟราคาทุกประเภทบน TradingView ครับ" },
  { k: ["telegram", "กลุ่ม", "สัญญาณ"], a: "สมาชิกจะได้สิทธิ์เข้ากลุ่ม Telegram ที่ส่งสัญญาณเรียลไทม์แยกตามไทม์เฟรม (M5/M15/M30/1H) — รับลิงก์เชิญในหน้าบัญชีหลังสมัครครับ" },
  { k: ["discord", "ดิสคอร์ด", "ชุมชน", "คอมมู"], a: "เซิร์ฟเวอร์ Discord เปิดให้ทุกคนเข้าได้ฟรีเลยครับ กดปุ่ม Discord ด้านล่างได้ — ส่วนห้องเฉพาะสมาชิกจะปลดล็อกตามแพ็กเกจที่สมัคร แจ้งชื่อผู้ใช้ Discord กับทีมงานหลังสมัครเพื่อรับสิทธิ์ครับ" },
];

// ไม่มีชิป "ยกเลิกได้ไหม" แล้ว — ชิปคือคำถามที่เราหยิบมาเสนอเอง
// ไม่ควรชวนให้คนคิดเรื่องเลิกใช้ตั้งแต่ยังไม่ได้สมัคร
// (กติกา "ยกเลิก/คืนเงิน" ใน RULES ยังอยู่ ใครพิมพ์ถามเองยังได้คำตอบเหมือนเดิม)
const CHIPS = ["ราคาเท่าไร", "ติดตั้งยังไง", "ใช้กับอะไรได้"];

function reply(text: string): string {
  const t = text.toLowerCase();
  for (const r of RULES) if (r.k.some((k) => t.includes(k.toLowerCase()))) return r.a;
  return "ขอโทษครับ เรื่องนี้ผมตอบได้ไม่ครบ — แนะนำกดปุ่ม คุยกับทีมงานบน LINE ด้านล่าง เดี๋ยวทีมงานช่วยดูให้ครับ 🙏";
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTimeout(() => setMsgs((m) => [...m, { role: "bot", text: reply(q) }]), 350);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl md:bottom-20">
          <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-strong to-brand-deep font-display text-sm font-bold text-brand-ink">
              {site.name.charAt(0)}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{site.name} Assistant</div>
              <div className="text-[11px] text-muted">บอทช่วยตอบ (ไม่ใช่คนจริง) · ตอบ 24 ชม.</div>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-muted hover:text-foreground" aria-label="ปิดแชท">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex max-h-[46vh] min-h-[220px] flex-col gap-2.5 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-brand-ink"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2 text-sm"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <button key={c} onClick={() => send(c)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted hover:border-brand/40 hover:text-foreground">
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-3">
            <a
              href={hasLineContact ? site.contact.lineUrl : "#pricing"}
              target={hasLineContact ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> คุยกับทีมงานจริงบน LINE
            </a>
            {hasDiscord && (
              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <DiscordIcon className="h-4 w-4" /> เข้าชุมชน Discord (ฟรี)
              </a>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-2 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์ข้อความ…"
                className="h-10 flex-1 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none placeholder:text-muted focus:border-brand/60"
              />
              <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink hover:bg-brand-strong" aria-label="ส่ง">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="เปิดแชท"
        className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-strong to-brand-deep text-brand-ink shadow-[0_10px_30px_-6px_rgba(101,230,44,0.5)] transition-transform hover:scale-105 md:bottom-5"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-background bg-brand" />}
      </button>
    </>
  );
}
