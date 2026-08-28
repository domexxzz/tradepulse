"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, Check, BellRing, Sparkles, ShieldOff } from "lucide-react";
import { subscribeEmail, type SubscribeState } from "@/lib/actions/subscriber";

const PERKS = [
  { icon: Sparkles, text: "ข่าวฟีเจอร์ใหม่ที่เพิ่มเข้าระบบ" },
  { icon: BellRing, text: "แจ้งเตือนเมื่อมีโปรโมชันหรือเปิดรอบคลาส" },
  { icon: ShieldOff, text: "ไม่สแปม ยกเลิกรับข่าวสารได้ทุกเมื่อ" },
];

export function EmailCapture() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribeEmail, {});

  return (
    <section id="newsletter" className="section-md">
      <div className="container-x">
        <div className="card-frame mx-auto max-w-3xl rounded-3xl p-8 sm:p-10">
          {state.ok ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
                <Check className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold">เรียบร้อย ขอบคุณครับ</h2>
              <p className="mt-2 text-muted">
                เราจะส่งข่าวสารไปให้ตามอีเมลที่แจ้งไว้ ระหว่างนี้ดูแพ็กเกจหรือเข้าชุมชนก่อนได้เลย
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="#pricing"
                  className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
                >
                  ดูแพ็กเกจ
                </Link>
                <Link
                  href="#community"
                  className="inline-flex h-11 items-center rounded-full border border-brand/40 px-6 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
                >
                  เข้าชุมชน Discord
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  <Mail className="h-3.5 w-3.5" /> รับข่าวสาร
                </p>
                {/* nowrap ครอบ "ก็ไม่เป็นไร" ไว้ ไม่งั้นถูกตัดกลางสำนวนเป็น "ก็ไม่ / เป็นไร"
                    (ดูหมายเหตุที่ .display ใน globals.css) */}
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  ยังไม่พร้อมสมัครวันนี้{" "}
                  <span className="whitespace-nowrap">ก็ไม่เป็นไร</span>
                </h2>
                <p className="mt-2 max-w-md text-muted">
                  ฝากอีเมลไว้ เราจะแจ้งเมื่อมีฟีเจอร์ใหม่หรือโปรโมชัน คุณจะได้ไม่พลาดรอบถัดไป
                </p>

                <ul className="mt-5 space-y-2">
                  {PERKS.map((p) => (
                    <li key={p.text} className="flex items-center gap-2.5 text-sm text-muted">
                      <p.icon className="h-4 w-4 shrink-0 text-brand" />
                      {p.text}
                    </li>
                  ))}
                </ul>
              </div>

              <form action={action} className="w-full md:w-[300px]">
                <input type="hidden" name="source" value="landing" />
                {/* honeypot กันบอท — คนจริงมองไม่เห็น */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />

                {state.error && (
                  <div className="mb-3 rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
                    {state.error}
                  </div>
                )}

                <label className="block">
                  <span className="sr-only">อีเมลของคุณ</span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-full border border-border bg-surface-2 px-5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
                  />
                </label>

                <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    name="consent"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span>
                    ยินยอมให้ส่งข่าวสารทางอีเมล ตาม
                    <Link href="/privacy" className="text-brand hover:underline">
                      {" "}
                      นโยบายความเป็นส่วนตัว
                    </Link>
                  </span>
                </label>

                <button
                  disabled={pending}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-50"
                >
                  {pending ? "กำลังบันทึก…" : "รับข่าวสาร"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
