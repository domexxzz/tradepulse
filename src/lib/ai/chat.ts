import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { marketContext } from "@/lib/ai/market";
import { callOpenAI, ModelError, type CallModel, type ModelInput } from "@/lib/ai/openai";
import {
  AI_HISTORY_MESSAGES,
  AI_MAX_MESSAGE_CHARS,
  AI_MONTHLY_LIMIT,
  AI_PENDING_STALE_MS,
  AI_USAGE_STATUS as U,
  type AiErrorCode,
} from "@/config/ai";

/**
 * QVX AI — ตัดสินว่าถามได้ไหม · จองโควตา · ถามโมเดล · บันทึก
 *
 * ต่างจากของเดิมบน Supabase ตรงที่ไม่มีตารางสิทธิ์ AI แยก: สิทธิ์ AI = สมาชิกภาพที่ยังไม่หมดอายุ
 * (ทั้งจ่ายเงินและรับผ่าน Wisdom) ของเดิมเปิดแล้วไม่มีวันหมด เพราะไม่มีอะไรไปปิดให้
 *
 * แยกจาก route เพื่อให้ UAT เรียกตรงกับฐานข้อมูลจริงได้ โดยส่งโมเดลปลอมเข้ามาแทน OpenAI
 */

export type AiUsageSummary = { used: number; limit: number; remaining: number; resetAt: string };

export type AskResult =
  | { ok: true; answer: string; conversationId: string; usage: AiUsageSummary }
  | { ok: false; error: AiErrorCode };

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

export async function askQvxAi(input: {
  userId: string;
  role?: string | null;
  message: string;
  conversationId?: string | null;
  callModel?: CallModel;
  now?: Date;
}): Promise<AskResult> {
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

  // จองก่อน นับทีหลัง — สองคำขอพร้อมกันที่คำถามที่ 300 จะเห็นกันและกัน ไม่หลุดเกินโควตา
  const reservation = await prisma.aiUsage.create({
    data: { userId: input.userId, conversationId, status: U.PENDING },
    select: { id: true },
  });
  const used = await prisma.aiUsage.count({ where: quotaWhere(input.userId, now) });
  if (used > AI_MONTHLY_LIMIT) {
    await prisma.aiUsage.delete({ where: { id: reservation.id } });
    return { ok: false, error: "AI_QUOTA_EXHAUSTED" };
  }

  const history = conversationId
    ? (
        await prisma.aiMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: AI_HISTORY_MESSAGES,
          select: { role: true, content: true },
        })
      )
        .reverse()
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    : [];

  const modelInput: ModelInput[] = [
    { role: "developer", content: await marketContext(now.getTime()) },
    ...history,
    { role: "user", content: message },
  ];

  const started = Date.now();
  let result;
  try {
    result = await (input.callModel ?? callOpenAI)(modelInput);
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "UNKNOWN";
    // ถามไม่สำเร็จ = คืนโควตา (สถานะ ERROR ไม่ถูกนับ)
    await prisma.aiUsage.update({
      where: { id: reservation.id },
      data: { status: U.ERROR, errorCode: code, latencyMs: Date.now() - started },
    });
    if (!(e instanceof ModelError)) console.error("QVX_AI_UNEXPECTED", e);
    return { ok: false, error: code === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "AI_TEMPORARILY_UNAVAILABLE" };
  }

  // สร้างแชตหลังได้คำตอบ — ถามครั้งแรกแล้วพัง จะไม่เหลือแชตว่างค้างในประวัติ
  const convId = await prisma.$transaction(async (tx) => {
    const id =
      conversationId ??
      (await tx.aiConversation.create({
        data: { userId: input.userId, title: conversationTitle(message) },
        select: { id: true },
      })).id;
    await tx.aiMessage.createMany({
      data: [
        { conversationId: id, role: "user", content: message },
        { conversationId: id, role: "assistant", content: result.answer, model: result.model },
      ],
    });
    await tx.aiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    await tx.aiUsage.update({
      where: { id: reservation.id },
      data: {
        status: U.SUCCESS,
        conversationId: id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: Date.now() - started,
      },
    });
    return id;
  });

  return { ok: true, answer: result.answer, conversationId: convId, usage: await getAiUsage(input.userId, now) };
}
