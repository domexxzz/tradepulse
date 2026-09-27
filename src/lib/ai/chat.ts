import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { getPromoState } from "@/lib/pricing";
import { marketForAi, type MarketForAi, type MarketLive } from "@/lib/ai/market";
import { QVX_INSTRUCTIONS } from "@/lib/ai/instructions";
import { QVX_CORE, QVX_MARKET_GLOSSARY } from "@/lib/ai/knowledge";
import { buildCorpus } from "@/lib/ai/corpus";
import { KnowledgeIndex, formatRetrieved } from "@/lib/ai/rag";
import { ModelError, openStream, type AiSource, type ChatMessage, type OpenModel } from "@/lib/ai/llm";
import {
  AI_HISTORY_MESSAGES,
  AI_MAX_MESSAGE_CHARS,
  AI_MONTHLY_LIMIT,
  AI_PENDING_STALE_MS,
  AI_USAGE_STATUS as U,
  type AiErrorCode,
} from "@/config/ai";

/**
 * QVX AI — ตัดสินว่าถามได้ไหม · จองโควตา · ประกอบคำสั่ง (RAG + กราฟสด) · บันทึก
 *
 * แบ่งเป็นสามขั้นเพื่อให้ route ตอบแบบ stream ได้: prepareAsk → (stream คำตอบ) → completeAsk / failAsk
 * askQvxAi() รวมสามขั้นแบบไม่ stream — ใช้ในชุดเทสต์และเป็นตัวอย่างลำดับที่ถูกต้อง
 *
 * สิทธิ์ AI = สมาชิกภาพที่ยังไม่หมดอายุ (จ่ายเงินและ Wisdom) ไม่มีตารางสิทธิ์แยก
 */

export type AiUsageSummary = { used: number; limit: number; remaining: number; resetAt: string };

export type AskResult =
  | { ok: true; answer: string; conversationId: string; usage: AiUsageSummary; source: AiSource; sources: string[] }
  | { ok: false; error: AiErrorCode };

export type Prepared = {
  userId: string;
  message: string;
  conversationId: string | null;
  reservationId: string;
  messages: ChatMessage[];
  /** ชื่อหัวข้อความรู้ที่ค้นเจอ — โชว์เป็น "อ้างอิง" ใต้คำตอบ */
  sources: string[];
  live: MarketLive[];
  /** คำถามวิเคราะห์กราฟสด — ส่งไปโมเดลที่คิดเก่งกว่าก่อน (ดู llm.ts) */
  marketQuestion: boolean;
  startedAt: number;
};

/** ต้นเดือนปฏิทินตามเวลาไทย (UTC+7 ไม่มีเวลาออมแสง) — โควตาเริ่มใหม่ตอนเที่ยงคืนวันที่ 1 ของไทย */
export function monthStartBangkok(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 7 * 3_600_000);
}

export function nextMonthStartBangkok(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - 7 * 3_600_000);
}

/** แอดมินใช้ได้เสมอ (ไว้ทดสอบ/ตอบลูกค้า) · คนอื่นต้องมีสมาชิกภาพที่ยังไม่หมดอายุ */
export async function canUseAi(userId: string, role?: string | null): Promise<boolean> {
  if (role === "ADMIN") return true;
  return (await getUserSubscription(userId)).isActive;
}

/** แถวที่กินโควตา: ตอบสำเร็จ + กำลังถามอยู่ (ยังไม่เก่า) — ถามแล้วพังไม่นับ */
function quotaWhere(userId: string, now: Date) {
  return {
    userId,
    createdAt: { gte: monthStartBangkok(now) },
    OR: [
      { status: U.SUCCESS },
      { status: U.PENDING, createdAt: { gte: new Date(now.getTime() - AI_PENDING_STALE_MS) } },
    ],
  };
}

export async function getAiUsage(userId: string, now: Date = new Date()): Promise<AiUsageSummary> {
  const used = await prisma.aiUsage.count({ where: quotaWhere(userId, now) });
  return {
    used,
    limit: AI_MONTHLY_LIMIT,
    remaining: Math.max(0, AI_MONTHLY_LIMIT - used),
    resetAt: nextMonthStartBangkok(now).toISOString(),
  };
}

/** ชื่อแชตจากคำถามแรก — ตัดให้สั้นพอแสดงในแถบประวัติ */
export const conversationTitle = (message: string) => {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
};

/** เลข TradingView ("30" "240" "D") → ชื่อที่คนอ่าน (M30 H4 D) */
const tfName = (tf: string) => (/^\d+$/.test(tf) ? (Number(tf) >= 60 ? `H${Number(tf) / 60}` : `M${tf}`) : tf);

/**
 * สรุปข้อเท็จจริงจากข้อมูลตลาดเป็นภาษาคน — ทดสอบกับ gemma3 จริงแล้วพบว่าถ้าไม่บอกตรง ๆ
 * โมเดลจะอ่านผิดว่า "แท่งยังวิ่งอยู่" ทั้งที่ปิดแล้ว · เป็นค่าที่คำนวณจากข้อมูล ไม่ได้แต่งเพิ่ม
 */
const TF_ALIASES: Record<string, string> = { M1: "M1", M5: "M5", M15: "M15", M30: "M30", H1: "H1", H4: "H4", D1: "D1", "1H": "H1", "4H": "H4" };

/** ไทม์เฟรมที่ผู้ใช้เอ่ยถึง ("M15", "h1") — ไม่เอ่ยเลยใช้ TF กราฟ + H1 + H4 (มองจากใหญ่ลงเล็กตามคำสั่งของน็อต) */
function askedTfs(text: string, chartTf: string): string[] {
  const found = [...text.toUpperCase().matchAll(/\b(M1|M5|M15|M30|H1|H4|D1|1H|4H)\b/g)].map((m) => TF_ALIASES[m[1]]);
  return found.length ? [...new Set(found)] : [...new Set([tfName(chartTf), "H1", "H4"])];
}

function marketFacts(market: MarketForAi, question = ""): string {
  return market.facts
    .map((f) =>
      [
        `- ${f.symbol} กราฟ ${tfName(f.chartTf)}: ราคาล่าสุด ${f.close ?? "ไม่ทราบ"}${/XAU|GOLD/i.test(f.symbol) ? " USD ต่อออนซ์ (ห้ามเรียกว่าบาท)" : ""} · แท่งล่าสุด${f.confirmed ? "ปิดแล้ว (ห้ามพูดว่าแท่งยังวิ่งอยู่)" : "ยังไม่ปิด มุมมองยังเปลี่ยนได้"}`,
        f.below.length ? `  โซนใต้ราคา (ถ้าจะใช้ ต้องรอราคา "ย่อลงมา" ทดสอบ): ${f.below.join(" · ")}` : "",
        f.above.length ? `  โซนเหนือราคา (ถ้าจะใช้ ต้องรอราคา "ดีดขึ้นไป" ทดสอบ): ${f.above.join(" · ")}` : "",
        ...askedTfs(question, f.chartTf).map((tf) => (f.tfs[tf] ? `  ${f.tfs[tf]}` : `  ${tf}: ไม่มีข้อมูล`)),
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
}

/**
 * ถามเรื่องสภาพตลาดไหม — แนบข้อมูลกราฟเฉพาะคำถามแบบนี้
 * ทดสอบกับ gemma3 แล้ว: แนบข้อมูลกราฟกับคำถามความรู้ (เช่น "ICT ต่างจาก Scalping ยังไง")
 * โมเดลจะเปิดคำตอบด้วยเรื่องกราฟที่ไม่มีใครถาม · พลาดตกหล่น = AI บอกให้ถามใหม่พร้อม TF (ปลอดภัย)
 */
const MARKET_WORDS = [
  "ตอนนี้", "ล่าสุด", "วันนี้", "กราฟ", "ราคาทอง", "ทอง", "xau", "gold", "น่าบาย", "น่าเซล", "น่าซื้อ", "น่าขาย",
  "เข้าได้", "เข้า buy", "เข้า sell", "buy ได้", "sell ได้", "เทรนด์", "trend", "แนวรับ", "แนวต้าน", "วิเคราะห์",
  "โซนไหน", "โซนตอนนี้", "ขึ้นหรือลง", "จะขึ้น", "จะลง", "ทิศทาง", "สัญญาณล่าสุด", "setup",
];
export function isMarketQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(m1|m5|m15|m30|h1|h4|d1)\b/i.test(text)) return true;
  return MARKET_WORDS.some((w) => t.includes(w));
}

/**
 * คำสั่งระบบก้อนเดียว (บางโมเดลเช่น gemma ไม่รองรับ system หลายก้อน):
 * คำสั่งของน็อต + แกนความรู้ + ชิ้นความรู้ที่ค้นเจอ + สถานะข้อมูลตลาดรอบนี้
 *
 * ตัวข้อมูลตลาด (JSON) ไม่อยู่ที่นี่ — แนบติดคำถามของผู้ใช้แทน ทดสอบกับ gemma3 บนคอมเบสแล้ว:
 * วางท้ายคำสั่งระบบยาว ๆ โมเดลมองไม่เห็นและตอบว่า "ขอข้อมูลกราฟหน่อย" ทั้งที่มีครบ
 * วางติดคำถาม โมเดลอ่านโซนและราคาได้ถูกต้อง
 */
function systemPrompt(retrieved: string, market: MarketForAi, attach: boolean): string {
  const status = !market.live.length
    ? `# สถานะข้อมูลตลาดรอบนี้\n${market.text}`
    : !attach
      ? `# สถานะข้อมูลตลาดรอบนี้\nคำถามนี้ไม่ได้ถามสภาพตลาดตอนนี้ ไม่ต้องพูดถึงราคา กราฟ หรือขอข้อมูลกราฟ ตอบเฉพาะสิ่งที่ถาม`
      : market.live.length
    ? `# สถานะข้อมูลตลาดรอบนี้
มีข้อมูลตลาดสดจากอินดิเคเตอร์ QVX แนบมาในข้อความล่าสุดของผู้ใช้แล้ว (หัวข้อ "# ข้อมูลตลาด") ให้ใช้วิเคราะห์ได้ทันที ห้ามขอข้อมูลหรือภาพกราฟเพิ่ม · ถ้าผู้ใช้ถาม timeframe ที่มีใน timeframes ให้ใช้ค่านั้น
${marketFacts(market)}
- อธิบายเป็นภาษาคน ห้ามพิมพ์ชื่อช่องข้อมูลดิบ (เช่น structure_trend, trend: 1, confirmed) ให้ผู้ใช้เห็น`
    : `# สถานะข้อมูลตลาดรอบนี้\n${market.text}`;
  return [
    QVX_INSTRUCTIONS,
    QVX_CORE,
    retrieved ? `# ข้อมูลอ้างอิงจากคลังความรู้ QVX (ค้นมาตามคำถามนี้)\n${retrieved}` : "",
    attach && market.live.length ? QVX_MARKET_GLOSSARY : "",
    status,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function prepareAsk(input: {
  userId: string;
  role?: string | null;
  message: string;
  conversationId?: string | null;
  now?: Date;
}): Promise<{ ok: true; prep: Prepared } | { ok: false; error: AiErrorCode }> {
  const now = input.now ?? new Date();
  const message = String(input.message ?? "").trim();
  if (!message || message.length > AI_MAX_MESSAGE_CHARS) return { ok: false, error: "INVALID_MESSAGE" };

  if (!(await canUseAi(input.userId, input.role))) return { ok: false, error: "AI_ACCESS_LOCKED" };

  // แชตต้องเป็นของคนถามเท่านั้น — ไม่งั้นเดา id แล้วอ่านบทสนทนาคนอื่นผ่านคำตอบของ AI ได้
  const conversationId = input.conversationId || null;
  if (conversationId) {
    const owned = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: input.userId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "CONVERSATION_NOT_FOUND" };
  }

  // จองก่อน นับทีหลัง — สองคำขอพร้อมกันที่คำถามสุดท้ายจะเห็นกันและกัน ไม่หลุดเกินโควตา
  const reservation = await prisma.aiUsage.create({
    data: { userId: input.userId, conversationId, status: U.PENDING },
    select: { id: true },
  });
  const used = await prisma.aiUsage.count({ where: quotaWhere(input.userId, now) });
  if (used > AI_MONTHLY_LIMIT) {
    await prisma.aiUsage.delete({ where: { id: reservation.id } });
    return { ok: false, error: "AI_QUOTA_EXHAUSTED" };
  }

  const [history, market, promo] = await Promise.all([
    conversationId
      ? prisma.aiMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: AI_HISTORY_MESSAGES,
          select: { role: true, content: true },
        })
      : Promise.resolve([]),
    marketForAi(now.getTime()),
    getPromoState(),
  ]);
  const past = history
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // ค้นด้วยคำถามนี้ + คำถามก่อนหน้า — ถามต่อแบบ "แล้วอันนั้นล่ะ" จะยังค้นเจอเรื่องเดิม
  const lastUser = [...past].reverse().find((m) => m.role === "user")?.content ?? "";
  // ถามต่อจากคำถามกราฟ ("แล้ว H1 ล่ะ") ก็นับเป็นคำถามกราฟ
  const attach = market.live.length > 0 && (isMarketQuestion(message) || (isMarketQuestion(lastUser) && message.length < 40));
  const hits = new KnowledgeIndex(buildCorpus(promo)).search(`${message} ${lastUser}`, 4);

  return {
    ok: true,
    prep: {
      userId: input.userId,
      message,
      conversationId,
      reservationId: reservation.id,
      messages: [
        { role: "system", content: systemPrompt(formatRetrieved(hits), market, attach) },
        ...past,
        // ข้อมูลตลาดติดคำถามรอบนี้เท่านั้น — ในประวัติเก็บคำถามเปล่า ไม่ให้ราคาเก่าปนมารอบหน้า
        // สรุปข้อเท็จจริงวางไว้ใกล้คำถามที่สุด — โมเดลเล็กให้น้ำหนักข้อความท้าย ๆ มากกว่าคำสั่งระบบยาว ๆ
        {
          role: "user",
          content: attach
            ? `# ข้อมูลตลาด\n${market.text}\n\n# สรุปข้อเท็จจริงจากระบบ (ยึดตามนี้)\n${marketFacts(market, `${message} ${lastUser}`)}\n\n---\nคำถามของผู้ใช้: ${message}`
            : message,
        },
      ],
      sources: hits.map((h) => h.doc.title),
      live: market.live,
      marketQuestion: attach,
      startedAt: Date.now(),
    },
  };
}

/** ตอบสำเร็จ — สร้างแชต (ถ้าเป็นคำถามแรก) บันทึกข้อความ และปิดการจองเป็น SUCCESS */
export async function completeAsk(
  prep: Prepared,
  result: { answer: string; model: string; source: AiSource; inputTokens: number; outputTokens: number },
  now: Date = new Date()
): Promise<{ conversationId: string; usage: AiUsageSummary }> {
  const convId = await prisma.$transaction(async (tx) => {
    const id =
      prep.conversationId ??
      (await tx.aiConversation.create({
        data: { userId: prep.userId, title: conversationTitle(prep.message) },
        select: { id: true },
      })).id;
    await tx.aiMessage.createMany({
      data: [
        { conversationId: id, role: "user", content: prep.message },
        { conversationId: id, role: "assistant", content: result.answer, model: `${result.source}:${result.model}`, sources: prep.sources },
      ],
    });
    await tx.aiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    await tx.aiUsage.update({
      where: { id: prep.reservationId },
      data: {
        status: U.SUCCESS,
        conversationId: id,
        model: `${result.source}:${result.model}`,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: Date.now() - prep.startedAt,
      },
    });
    return id;
  });
  return { conversationId: convId, usage: await getAiUsage(prep.userId, now) };
}

/** ตอบไม่สำเร็จ = คืนโควตา (สถานะ ERROR ไม่ถูกนับ) */
export async function failAsk(prep: Prepared, code: string): Promise<void> {
  await prisma.aiUsage
    .update({
      where: { id: prep.reservationId },
      data: { status: U.ERROR, errorCode: code.slice(0, 60), latencyMs: Date.now() - prep.startedAt },
    })
    .catch((e) => console.error("failAsk: update failed", e));
}

export function errorFor(code: string): AiErrorCode {
  return code === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "AI_TEMPORARILY_UNAVAILABLE";
}

/** ครบทั้งวงแบบไม่ stream — ชุดเทสต์ใช้ตัวนี้ (ส่งโมเดลปลอมผ่าน openModel) */
export async function askQvxAi(input: {
  userId: string;
  role?: string | null;
  message: string;
  conversationId?: string | null;
  openModel?: OpenModel;
  now?: Date;
}): Promise<AskResult> {
  const prepared = await prepareAsk(input);
  if (!prepared.ok) return prepared;
  const { prep } = prepared;

  let answer = "";
  let usage = { inputTokens: 0, outputTokens: 0 };
  let opened;
  try {
    opened = await (input.openModel ?? openStream)(prep.messages, Date.now() + 55_000, { preferCloud: prep.marketQuestion });
    for await (const ev of opened.events) {
      if (ev.type === "delta") answer += ev.text;
      else usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens };
    }
    if (!answer.trim()) throw new ModelError("EMPTY_ANSWER");
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "UNKNOWN";
    if (!(e instanceof ModelError)) console.error("QVX_AI_UNEXPECTED", e);
    await failAsk(prep, code);
    return { ok: false, error: errorFor(code) };
  }

  const done = await completeAsk(prep, { answer: answer.trim(), model: opened.model, source: opened.source, ...usage }, input.now);
  return { ok: true, answer: answer.trim(), conversationId: done.conversationId, usage: done.usage, source: opened.source, sources: prep.sources };
}
