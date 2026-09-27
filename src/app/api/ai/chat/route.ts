import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { askQvxAi } from "@/lib/ai/chat";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { AI_ERROR_MESSAGES, AI_RATE_LIMIT_PER_MINUTE, type AiErrorCode } from "@/config/ai";

export const dynamic = "force-dynamic";
// โมเดลคิดนานได้ถึง ~50 วินาที (timeout ใน lib/ai/openai.ts) — เผื่อเวลาบันทึกผลอีกนิด
export const maxDuration = 60;

const STATUS: Record<AiErrorCode, number> = {
  INVALID_MESSAGE: 400,
  AI_ACCESS_LOCKED: 403,
  CONVERSATION_NOT_FOUND: 404,
  AI_QUOTA_EXHAUSTED: 429,
  AI_RATE_LIMITED: 429,
  AI_NOT_CONFIGURED: 503,
  AI_TEMPORARILY_UNAVAILABLE: 503,
};

const fail = (error: AiErrorCode) =>
  NextResponse.json({ error, message: AI_ERROR_MESSAGES[error] }, { status: STATUS[error] });

/** หน้าแชตเรียกทางนี้ — ตรรกะทั้งหมดอยู่ใน lib/ai/chat.ts */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // นับทุกครั้งที่ส่ง ไม่ใช่เฉพาะที่พลาด — ตัวที่ต้องกันคือการยิงรัวจนเปลืองค่า API
  const rlKey = `ai:${session.user.id}`;
  if (await isRateLimited(rlKey, AI_RATE_LIMIT_PER_MINUTE, 60_000)) return fail("AI_RATE_LIMITED");
  await recordAttempt(rlKey, 60_000);

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_MESSAGE");
  }

  const r = await askQvxAi({
    userId: session.user.id,
    role: session.user.role,
    message: typeof body.message === "string" ? body.message : "",
    conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
  });
  if (!r.ok) return fail(r.error);
  return NextResponse.json(r);
}
