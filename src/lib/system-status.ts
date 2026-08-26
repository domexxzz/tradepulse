/**
 * ตรวจว่าแต่ละระบบ "ตั้งค่าแล้ว" และ "ติดต่อได้จริง" หรือยัง
 *
 * มีไว้เพราะระบบนี้พึ่งของนอกบ้านเยอะ (บอทบนเครื่องที่บ้าน, Telegram, Discord, อีเมล)
 * และบางตัวหายไปเงียบ ๆ ได้ เช่นเครื่องที่รันบอทถูกปิดตอนกลางคืน
 * ถ้าไม่มีหน้าให้ดู แอดมินจะรู้ตัวอีกทีตอนลูกค้าทัก
 */
import { tvAutoGrantEnabled } from "@/lib/tradingview";
import { telegramEnabled, telegramGroupManaged } from "@/lib/telegram";
import { discordBotEnabled } from "@/lib/discord";
import { emailEnabled } from "@/lib/email";
import { slipVerifyEnabled, slipAutoApprove } from "@/lib/slip-verify";
import { promptpayEnabled } from "@/lib/promptpay";
import { stripeEnabled } from "@/lib/stripe";

export type Health = "ok" | "warn" | "off" | "down";

export interface StatusRow {
  name: string;
  health: Health;
  detail: string;
  /** สิ่งที่ต้องทำถ้าไม่เขียว */
  action?: string;
}

/** ยิง /health ของบอท TradingView — timeout สั้น ๆ ไม่ให้หน้าแอดมินค้าง */
async function checkTradingViewBridge(): Promise<StatusRow> {
  const name = "บอทให้สิทธิ์ TradingView";
  if (!tvAutoGrantEnabled) {
    return {
      name,
      health: "off",
      detail: "ยังไม่ได้ตั้งค่า — แอดมินเพิ่ม username เองในคิว",
      action: "ตั้ง TV_BOT_URL และ TV_BOT_SECRET",
    };
  }

  const url = `${process.env.TV_BOT_URL?.replace(/\/$/, "")}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; queue?: number; indicator?: string }
      | null;

    if (!res.ok || !data?.ok) {
      return { name, health: "down", detail: `บอทตอบกลับ ${res.status}`, action: "ดู log บนเครื่องที่รันบอท" };
    }
    return {
      name,
      health: "ok",
      detail: `พร้อมใช้งาน · คิว ${data.queue ?? 0} งาน · สคริปต์: ${data.indicator ?? "-"}`,
    };
  } catch {
    // บอทเป็นโค้ด blocking ระหว่างทำงานจะไม่ตอบ health — แยกจากเครื่องปิดไม่ได้จากตรงนี้
    return {
      name,
      health: "down",
      detail: "ติดต่อบอทไม่ได้ (เครื่องปิดอยู่ หรือกำลังทำงานอยู่)",
      action: "เปิดเครื่องที่รันบอท — ระหว่างนี้คำขอจะไปรอในคิวให้ทำมือ",
    };
  }
}

/** ถาม Telegram ว่าโทเคนยังใช้ได้ไหม */
async function checkTelegram(): Promise<StatusRow> {
  const name = "Telegram";
  if (!telegramEnabled) {
    return { name, health: "off", detail: "ยังไม่ได้ตั้งโทเคน/กลุ่ม", action: "ตั้ง TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.ok) return { name, health: "down", detail: `โทเคนใช้ไม่ได้: ${data.description ?? "?"}`, action: "ออกโทเคนใหม่ที่ @BotFather" };

    const auto = telegramGroupManaged && Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);
    return {
      name,
      health: auto ? "ok" : "warn",
      detail: auto
        ? `@${data.result.username} · เชิญเข้ากลุ่มอัตโนมัติเปิดอยู่`
        : `@${data.result.username} · ยังไม่ได้เปิดเชิญอัตโนมัติ`,
      action: auto ? undefined : "ตั้ง TELEGRAM_WEBHOOK_SECRET แล้วรัน scripts/telegram-webhook.mjs set",
    };
  } catch {
    return { name, health: "down", detail: "ติดต่อ Telegram ไม่ได้" };
  }
}

function configRow(name: string, on: boolean, onText: string, offText: string, action?: string): StatusRow {
  return { name, health: on ? "ok" : "off", detail: on ? onText : offText, action: on ? undefined : action };
}

/** ตรวจทุกระบบพร้อมกัน — ตัวที่ต้องยิงเน็ตมี timeout คุมอยู่แล้ว */
export async function getSystemStatus(): Promise<StatusRow[]> {
  const [bridge, telegram] = await Promise.all([checkTradingViewBridge(), checkTelegram()]);

  return [
    bridge,
    telegram,
    configRow("ยศ Discord", discordBotEnabled, "ให้ยศอัตโนมัติเมื่ออนุมัติสลิป", "ยังไม่ได้ตั้งบอท", "ดู docs/DISCORD.md"),
    configRow(
      "อีเมล",
      emailEnabled,
      "ส่งใบเสร็จ / เตือนหมดอายุ / ลืมรหัสผ่าน ได้",
      "ยังไม่ได้ตั้งค่า — สมาชิกรีเซ็ตรหัสผ่านเองไม่ได้",
      "ตั้ง RESEND_API_KEY + EMAIL_FROM"
    ),
    configRow(
      "งานประจำวัน (ปิดสิทธิ์หมดอายุ)",
      Boolean(process.env.CRON_SECRET),
      "เปิดอยู่ — ปิดสิทธิ์และเตือนล่วงหน้าอัตโนมัติ",
      "⚠️ ปิดอยู่ — สมาชิกจะไม่มีวันหมดอายุ",
      "ตั้ง CRON_SECRET บน Vercel"
    ),
    configRow("รับเงิน PromptPay", promptpayEnabled, "สร้าง QR ตามยอดได้", "ยังไม่ได้ตั้งพร้อมเพย์", "ตั้ง PROMPTPAY_ID"),
    {
      name: "ตรวจสลิปอัตโนมัติ",
      health: slipVerifyEnabled ? "ok" : "off",
      detail: slipVerifyEnabled
        ? slipAutoApprove
          ? "อ่านยอดและอนุมัติให้เองเมื่อตรง"
          : "อ่านยอดให้ แต่ยังต้องกดอนุมัติเอง"
        : "ปิดอยู่ — ตรวจสลิปด้วยตาทุกใบ",
      action: slipVerifyEnabled ? undefined : "ตั้ง EASYSLIP_TOKEN (ไม่บังคับ)",
    },
    configRow("Stripe", stripeEnabled, "พร้อมรับบัตร/ตัดอัตโนมัติ", "ปิดอยู่ (ใช้ PromptPay แทน)", "ไม่บังคับ"),
  ];
}
