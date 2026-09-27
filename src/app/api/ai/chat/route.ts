import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeAsk, errorFor, failAsk, prepareAsk } from "@/lib/ai/chat";
import { ModelError, openStream, providers } from "@/lib/ai/llm";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { AI_ERROR_MESSAGES, AI_RATE_LIMIT_PER_MINUTE, type AiErrorCode } from "@/config/ai";

export const dynamic = "force-dynamic";
// เครื่องบ้านรอคำแรกได้ 25 วินาที สลับไปคลาวด์อีก 20 — ต้องตอบจบก่อน Vercel ตัดที่ 60
export const maxDuration = 60;
const ANSWER_DEADLINE_MS = 55_000;

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

/**
 * หน้าแชตเรียกทางนี้ — ตอบเป็น NDJSON ทีละบรรทัดให้ข้อความค่อย ๆ ขึ้นระหว่างโมเดลคิด
 *   {"t":"meta","source":"local"|"cloud","sources":[ชื่อหัวข้อความรู้],"live":[กราฟสด]}
 *   {"t":"d","v":"ข้อความส่วนถัดไป"} ...
 *   {"t":"done","conversationId":"...","usage":{...}}   หรือ   {"t":"error","error":"...","message":"..."}
 * ผิดตั้งแต่ก่อนเริ่ม (ไม่มีสิทธิ์ โควตาหมด ฯลฯ) ตอบ JSON ปกติพร้อม status code
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // นับทุกครั้งที่ส่ง ไม่ใช่เฉพาะที่พลาด — ตัวที่ต้องกันคือการยิงรัวจนการ์ดจอ/ค่า API หมด
  const rlKey = `ai:${session.user.id}`;
  if (await isRateLimited(rlKey, AI_RATE_LIMIT_PER_MINUTE, 60_000)) return fail("AI_RATE_LIMITED");
  await recordAttempt(rlKey, 60_000);

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_MESSAGE");
  }

  // ไม่มีทางไหนตอบได้เลย — บอกก่อนจองโควตา
  if (!(await providers()).length) return fail("AI_NOT_CONFIGURED");

  const prepared = await prepareAsk({
    userId: session.user.id,
    role: session.user.role,
    message: typeof body.message === "string" ? body.message : "",
    conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
  });
  if (!prepared.ok) return fail(prepared.error);
  const { prep } = prepared;
  const deadline = Date.now() + ANSWER_DEADLINE_MS;

  const encoder = new TextEncoder();
  let cancelled = false;
  let stopModel: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // ลูกค้ากดหยุด/ปิดหน้าแล้วห้าม enqueue ต่อ (จะ throw) — เงียบไว้แล้วจบงาน
      const send = (obj: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          cancelled = true;
        }
      };
      let answer = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      try {
        const opened = await openStream(prep.messages, deadline, { preferCloud: prep.marketQuestion });
        stopModel = opened.abort;
        if (cancelled) throw new ModelError("CLIENT_STOPPED");
        send({ t: "meta", source: opened.source, sources: prep.sources, live: prep.live });
        for await (const ev of opened.events) {
          if (cancelled) throw new ModelError("CLIENT_STOPPED");
          if (ev.type === "delta") {
            answer += ev.text;
            send({ t: "d", v: ev.text });
          } else {
            usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens };
          }
        }
        if (!answer.trim()) throw new ModelError("EMPTY_ANSWER");
        const done = await completeAsk(prep, { answer: answer.trim(), model: opened.model, source: opened.source, ...usage });
        send({ t: "done", conversationId: done.conversationId, usage: done.usage, source: opened.source });
      } catch (e) {
        const code = e instanceof ModelError ? e.code : "UNKNOWN";
        if (!(e instanceof ModelError)) console.error("QVX_AI_STREAM_UNEXPECTED", e);
        await failAsk(prep, code);
        const error = errorFor(code);
        send({ t: "error", error, message: AI_ERROR_MESSAGES[error], partial: Boolean(answer) });
      } finally {
        try {
          controller.close();
        } catch {
          /* ปิดไปแล้วตอนลูกค้ายกเลิก */
        }
      }
    },
    cancel() {
      // ลูกค้ากดหยุด — หยุดโมเดลด้วย ไม่ปล่อยให้การ์ดจอคิดต่อทั้งที่ไม่มีคนอ่าน
      cancelled = true;
      stopModel?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
