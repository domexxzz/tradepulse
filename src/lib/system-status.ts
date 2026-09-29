/**
 * ตรวจว่าแต่ละระบบ "ตั้งค่าแล้ว" และ "ติดต่อได้จริง" หรือยัง
 *
 * มีไว้เพราะระบบนี้พึ่งของนอกบ้านเยอะ (บอทบนเครื่องที่บ้าน, Telegram, Discord, อีเมล)
 * และบางตัวหายไปเงียบ ๆ ได้ เช่นเครื่องที่รันบอทถูกปิดตอนกลางคืน
 * ถ้าไม่มีหน้าให้ดู แอดมินจะรู้ตัวอีกทีตอนลูกค้าทัก
 */
import { bridgeUrls, tvAutoGrantEnabled } from "@/lib/tradingview";
import { checkGroupPermissions, telegramEnabled, telegramGroupManaged } from "@/lib/telegram";
import { discordBotEnabled } from "@/lib/discord";
import { emailEnabled, emailConfigStatus } from "@/lib/email";
import { slipVerifyEnabled, slipAutoApprove } from "@/lib/slip-verify";
import { promptpayEnabled } from "@/lib/promptpay";
import { stripeEnabled } from "@/lib/stripe";
import { aiEngineStatus } from "@/lib/ai/gateway";
import { liveMarkets } from "@/lib/ai/market";
import { enabledOAuthProviders } from "@/lib/oauth-env";

export type Health = "ok" | "warn" | "off" | "down";

/**
 * ปุ่มล็อกอิน Google/LINE เปิดอยู่ไหม
 *
 * เพิ่มทีหลัง เพราะเคยพังเงียบอยู่นาน: env ตั้งชื่อคนละแบบกับที่โค้ดมองหา ปุ่มเลยหาย
 * ไปทั้งคู่ และหน้านี้ไม่เคยตรวจเรื่องล็อกอินเลยจึงไม่มีใครเห็น (เจอตอน 28 ก.ย. 2569)
 */
function loginProvidersRow(): StatusRow {
  const name = "ล็อกอินด้วย Google / LINE";
  const on = enabledOAuthProviders();
  if (on.length === 2) return { name, health: "ok", detail: "เปิดครบทั้งสองทาง — Google และ LINE" };
  if (on.length === 1) {
    return {
      name,
      health: "warn",
      detail: `เปิดแค่ ${on[0]} — อีกทางลูกค้าใช้ไม่ได้`,
      action: "ตั้งคีย์ของอีกเจ้าให้ครบทั้ง ID และ SECRET",
    };
  }
  return {
    name,
    health: "off",
    detail: "ปิดทั้งคู่ — สมัคร/เข้าสู่ระบบได้ด้วยรหัสผ่านทางเดียว",
    action: "ตั้ง AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET และ AUTH_LINE_ID + AUTH_LINE_SECRET (คีย์ต้องครบคู่)",
  };
}

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

  // ดูตัวที่เว็บจะยิงจริง (ตัวที่บอทรายงานเข้ามาก่อน env)
  const url = `${(await bridgeUrls()).primary}/health`;
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

    /* โทเคนใช้ได้ ไม่ได้แปลว่าบอททำงานในกลุ่มได้ — บอทอยู่ในกลุ่มโดยไม่มีสิทธิ์อะไรเลยก็ได้
       ซึ่งจะเงียบจนกว่าจะมีลูกค้าไม่ได้ลิงก์ หรือคนหมดอายุไม่ถูกเตะออก
       โชว์ชื่อกลุ่มด้วย เพื่อให้ยืนยันด้วยตาได้ว่าชี้ถูกห้อง (เคยชี้ผิดห้องมาแล้ว) */
    const perm = await checkGroupPermissions();
    const missing = [
      !perm.canInvite && "เชิญผ่านลิงก์",
      !perm.canRemove && "แบน/นำสมาชิกออก",
    ].filter(Boolean).join(" และ ");

    if (!perm.inGroup) {
      return {
        name,
        health: "down",
        detail: `@${data.result.username} · ❌ บอทไม่ได้อยู่ในกลุ่มที่ตั้งค่าไว้ — ลูกค้าจะไม่ได้ลิงก์เลย`,
        action: "เชิญบอทเข้ากลุ่ม แล้วตั้งเป็นผู้ดูแล",
      };
    }
    if (missing) {
      return {
        name,
        health: "down",
        detail: `@${data.result.username} · กลุ่ม "${perm.title ?? "?"}" · ❌ บอทไม่มีสิทธิ์ ${missing}`,
        action: "ตั้งบอทเป็นผู้ดูแลในกลุ่ม แล้วเปิดสิทธิ์ที่ขาด",
      };
    }

    return {
      name,
      health: auto ? "ok" : "warn",
      detail: auto
        ? `@${data.result.username} · กลุ่ม "${perm.title ?? "?"}" · เชิญเข้ากลุ่มอัตโนมัติเปิดอยู่`
        : `@${data.result.username} · กลุ่ม "${perm.title ?? "?"}" · ยังไม่ได้เปิดเชิญอัตโนมัติ`,
      action: auto ? undefined : "ตั้ง TELEGRAM_WEBHOOK_SECRET แล้วรัน scripts/telegram-webhook.mjs set",
    };
  } catch {
    return { name, health: "down", detail: "ติดต่อ Telegram ไม่ได้" };
  }
}

/**
 * อีเมลต้องขึ้นสีแดง ไม่ใช่ "ปิดอยู่" สีเทา
 *
 * ของเดิมใช้ configRow ซึ่งแสดงเป็น "ปิดอยู่" เหมือนฟีเจอร์ที่เลือกไม่เปิด
 * แต่อีเมลไม่ใช่ของเสริม — ปิดอยู่แปลว่าลูกค้าที่จ่ายเงินไม่ได้รับใบเสร็จ
 * ไม่ได้ลิงก์เข้ากลุ่ม และรีเซ็ตรหัสผ่านเองไม่ได้ โดยที่ไม่มีอะไรฟ้องเลย
 * (เจอจริง 29 ก.ย. 69 — RESEND_API_KEY เป็นค่าว่างบน production
 * อีเมลทุกฉบับถูกข้ามเงียบ ๆ มาตลอด และหน้านี้ก็ขึ้นเทา ๆ จนไม่มีใครเอะใจ)
 */
function emailRow(): StatusRow {
  if (emailEnabled) {
    return {
      name: "อีเมล",
      health: "ok",
      detail: "ส่งใบเสร็จ / ลิงก์กลุ่ม / เตือนหมดอายุ / ลืมรหัสผ่าน ได้",
    };
  }

  const { hasKey, hasFrom } = emailConfigStatus();
  const missing = [!hasKey && "RESEND_API_KEY", !hasFrom && "EMAIL_FROM"].filter(Boolean).join(" และ ");
  return {
    name: "อีเมล",
    health: "down",
    detail: `❌ ส่งอีเมลไม่ออกเลย — ลูกค้าไม่ได้รับใบเสร็จ ไม่ได้ลิงก์เข้ากลุ่ม และรีเซ็ตรหัสผ่านเองไม่ได้ (ขาด ${missing})`,
    action: `ตั้ง ${missing} บน Vercel แล้ว deploy ใหม่หนึ่งครั้ง`,
  };
}

function configRow(name: string, on: boolean, onText: string, offText: string, action?: string): StatusRow {
  return { name, health: on ? "ok" : "off", detail: on ? onText : offText, action: on ? undefined : action };
}

/** ตรวจทุกระบบพร้อมกัน — ตัวที่ต้องยิงเน็ตมี timeout คุมอยู่แล้ว */
export async function getSystemStatus(): Promise<StatusRow[]> {
  const [bridge, telegram, ai, live] = await Promise.all([
    checkTradingViewBridge(),
    checkTelegram(),
    aiEngineStatus(),
    liveMarkets(),
  ]);

  return [
    bridge,
    telegram,
    {
      name: "QVX AI",
      health: ai.local.up && ai.cloud.configured ? "ok" : ai.available ? "warn" : "down",
      detail: ai.local.up
        ? ai.cloud.configured
          ? "เครื่องบ้าน (gemma3) ตอบอยู่ · มีคลาวด์สำรอง"
          : "เครื่องบ้าน (gemma3) ตอบอยู่ · ⚠️ ไม่มีตัวสำรอง ถ้าคอมเบสดับ AI จะดับ"
        : ai.cloud.configured
          ? "⚠️ เครื่องบ้านไม่ตอบ — ใช้คลาวด์สำรองอยู่ (เสียค่า API)"
          : "❌ ตอบไม่ได้ — เครื่องบ้านไม่ตอบและไม่มีคลาวด์สำรอง",
      action: ai.local.up ? (ai.cloud.configured ? undefined : "ตั้ง OPENAI_API_KEY (Grok/OpenAI) ไว้เป็นตัวสำรอง") : "เช็กคอมเบส: task QVXAIGateway + QVXAIKeeper (docs/QVX_AI.md)",
    },
    {
      name: "ข้อมูลกราฟสดให้ AI",
      health: live.length ? "ok" : "warn",
      detail: live.length
        ? `รับอยู่: ${live.map((m) => `${m.symbol} ${m.chartTf}`).join(", ")}`
        : "ยังไม่มีข้อมูลล่าสุด — AI ตอบจากความรู้อย่างเดียว",
      action: live.length ? undefined : "ตั้ง MARKET_WEBHOOK_TOKEN + alert QVX AI บน TradingView ชี้มาที่ /api/market/snapshot",
    },
    loginProvidersRow(),
    configRow("ยศ Discord", discordBotEnabled, "ให้ยศอัตโนมัติเมื่ออนุมัติสลิป", "ยังไม่ได้ตั้งบอท", "ดู docs/DISCORD.md"),
    emailRow(),
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
