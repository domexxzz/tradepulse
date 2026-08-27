"use client";

import { Button } from "@/components/ui/Button";
import Image from "next/image";
import { Check, Lock } from "lucide-react";
import { useState } from "react";

const points = [
  "สัญญาณ Buy / Sell พร้อม Entry, TP และ SL ครบในข้อความเดียว",
  "แยกห้องตาม Timeframe — M5 / M15 / M30 / H1",
  "ส่งทันทีที่อินดิเคเตอร์ยิงสัญญาณ ไม่ต้องเฝ้าหน้าจอ",
  "ดูสัญญาณย้อนหลังในกลุ่มได้ทุกเมื่อ",
];

const signalExamples = [
  {
    timeframe: "M5",
    src: "/images/signals/telegram-m5-redacted.png",
    alt: "ตัวอย่างสัญญาณ Telegram ห้อง M5 พร้อม Entry Stop Loss และ Take Profit",
  },
  {
    timeframe: "M15",
    src: "/images/signals/telegram-m15-redacted.png",
    alt: "ตัวอย่างสัญญาณ Telegram ห้อง M15 พร้อมผล TP2 และ Stop Loss",
  },
  {
    timeframe: "M30",
    src: "/images/signals/telegram-m30-redacted.png",
    alt: "ตัวอย่างสัญญาณ Telegram ห้อง M30 พร้อม Entry Stop Loss และ Take Profit",
  },
  {
    timeframe: "H1",
    src: "/images/signals/telegram-h1-redacted.png",
    alt: "ตัวอย่างสัญญาณ Telegram ห้อง H1 พร้อม Entry Stop Loss และ Take Profit",
  },
] as const;

export function TelegramAlerts() {
  const [activeTimeframe, setActiveTimeframe] = useState("M15");
  const activeExample =
    signalExamples.find((example) => example.timeframe === activeTimeframe) ?? signalExamples[1];

  return (
    <div id="telegram">
      <div className="container-x grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <Lock className="h-3.5 w-3.5" /> Telegram Alerts · เฉพาะสมาชิก
          </p>
          {/* nowrap ครอบ "เรียลไทม์" ไว้ ไม่งั้น Chrome ตัดเป็น "แบบเรี / ยลไทม์"
              (พจนานุกรมตัดคำไทยของ ICU ไม่รู้จักคำทับศัพท์ — ดูหมายเหตุที่ .display ใน globals.css) */}
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            สัญญาณส่งเข้า Telegram แบบ<span className="whitespace-nowrap">เรียลไทม์</span>
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            สมาชิกจะได้รับสิทธิ์เข้ากลุ่ม Telegram ที่เชื่อมสัญญาณจากอินดิเคเตอร์อัตโนมัติ —
            แยกห้องตามไทม์เฟรม รับจังหวะเข้าเทรดได้ทันทีทุกที่
          </p>
          <ul className="mt-5 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button href="#pricing" size="lg">สมัครเพื่อเข้ากลุ่ม Telegram</Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            🔒 เข้ากลุ่มได้เฉพาะสมาชิก — ลิงก์เข้ากลุ่มอยู่ในหน้าบัญชีของคุณทันทีหลังยืนยันการชำระเงิน
          </p>
        </div>

        <div className="mx-auto w-full max-w-[29rem]">
          <div className="rounded-[1.75rem] border border-border bg-background/90 p-2.5 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur">
            <div
              className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface p-1"
              role="group"
              aria-label="เลือกตัวอย่างสัญญาณตาม Timeframe"
            >
              {signalExamples.map((example) => {
                const isActive = activeExample.timeframe === example.timeframe;
                return (
                  <button
                    key={example.timeframe}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveTimeframe(example.timeframe)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      isActive
                        ? "bg-brand text-brand-ink shadow-sm"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {example.timeframe}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-2 aspect-[9/16] overflow-hidden rounded-[1.4rem] border border-border bg-black">
              <Image
                key={activeExample.timeframe}
                src={activeExample.src}
                alt={activeExample.alt}
                fill
                sizes="(max-width: 1024px) calc(100vw - 48px), 460px"
                className="object-contain"
              />
              <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                ภาพจากกลุ่มจริง · {activeExample.timeframe}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 px-2 pb-1 pt-3 text-[11px] text-muted">
              <span>แตะเลือก Timeframe เพื่อดูตัวอย่าง</span>
              <span className="text-right">ปิดชื่อบัญชีเพื่อความเป็นส่วนตัว</span>
            </div>
          </div>
          <p className="mx-auto mt-3 max-w-sm text-center text-[11px] leading-relaxed text-muted">
            ตัวอย่างเป็นข้อมูลย้อนหลัง มีทั้งผลกำไรและขาดทุน ไม่รับประกันผลลัพธ์ในอนาคต
          </p>
        </div>
      </div>
    </div>
  );
}
