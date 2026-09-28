import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { adminFacts, adminSystemPrompt } from "@/lib/ai/admin-facts";
import { ModelError, openStream, providers } from "@/lib/ai/llm";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { AI_ERROR_MESSAGES, AI_MAX_MESSAGE_CHARS, AI_RATE_LIMIT_PER_MINUTE } from "@/config/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const ANSWER_DEADLINE_MS = 55_000;

/**
 * ผู้ช่วยแอดมิน — ถามเรื่องสถานะธุรกิจได้ตรง ๆ
 *
 * ต่างจาก /api/ai/chat ตรงที่:
 *   - ไม่กินโควตาของสมาชิก (คนละเรื่องกับที่ลูกค้าจ่ายเงินมาใช้)
 *   - ไม่เก็บบทสนทนาลงฐานข้อมูล — คำถามแอดมินพ่วงข้อมูลธุรกิจ ไม่ควรค้างไว้ในตาราง
 *     ที่ออกแบบมาให้ลูกค้าอ่านประวัติตัวเอง
 *   - แนบ "ข้อมูลระบบ ณ ตอนนี้" ที่คำนวณจากคำสั่งตายตัว ไม่ใช่ SQL ที่ AI เขียนเอง
 *
 * ตอบเป็น NDJSON เหมือนแชตสมาชิก หน้าเว็บจึงอ่านด้วยวิธีเดียวกัน
 */
export async function POST(req: Request) {
  // ไม่ใช่แอดมิน = โยน redirect/ข้อผิดพลาดตั้งแต่บรรทัดนี้ ไม่มีทางหลุดไปถึงข้อมูล
  const session = await requireAdmin();

  const rlKey = `admin-ai:${session.user.id}`;
  if (await isRateLimited(rlKey, AI_RATE_LIMIT_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "AI_RATE_LIMITED", message: AI_ERROR_MESSAGES.AI_RATE_LIMITED }, { status: 429 });
  }
  await recordAttempt(rlKey, 60_000);

  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_MESSAGE", message: AI_ERROR_MESSAGES.INVALID_MESSAGE }, { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message || message.length > AI_MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "INVALID_MESSAGE", message: AI_ERROR_MESSAGES.INVALID_MESSAGE }, { status: 400 });
  }

  if (!(await providers()).length) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED", message: AI_ERROR_MESSAGES.AI_NOT_CONFIGURED },
      { status: 503 }
    );
  }

  const facts = await adminFacts();
  const messages = [
    { role: "system" as const, content: adminSystemPrompt() },
    // ข้อเท็จจริงวางไว้ติดคำถาม — โมเดลให้น้ำหนักข้อความท้าย ๆ มากกว่าคำสั่งระบบยาว ๆ
    // (บทเรียนเดิมจากแชตสมาชิก: วางข้อมูลกราฟไว้ใน system prompt แล้วโมเดลมองข้าม)
    {
      role: "user" as const,
      content: `# ข้อมูลระบบ ณ ตอนนี้ (ยึดตามนี้ ห้ามเดาเพิ่ม)\n${facts.text}\n\n---\nคำถามของแอดมิน: ${message}`,
    },
  ];

  const deadline = Date.now() + ANSWER_DEADLINE_MS;
  const encoder = new TextEncoder();
  let cancelled = false;
  let stopModel: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          cancelled = true;
        }
      };
      let answer = "";
      try {
        const opened = await openStream(messages, deadline);
        stopModel = opened.abort;
        if (cancelled) throw new ModelError("CLIENT_STOPPED");
        send({ t: "meta", source: opened.source, counts: facts.counts });
        for await (const ev of opened.events) {
          if (cancelled) throw new ModelError("CLIENT_STOPPED");
          if (ev.type === "delta") {
            answer += ev.text;
            send({ t: "d", v: ev.text });
          }
        }
        if (!answer.trim()) throw new ModelError("EMPTY_ANSWER");
        send({ t: "done", source: opened.source });
      } catch (e) {
        if (!(e instanceof ModelError)) console.error("QVX_ADMIN_AI_UNEXPECTED", e);
        send({
          t: "error",
          error: "AI_TEMPORARILY_UNAVAILABLE",
          message: AI_ERROR_MESSAGES.AI_TEMPORARILY_UNAVAILABLE,
          partial: Boolean(answer),
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* ปิดไปแล้วตอนผู้ใช้ยกเลิก */
        }
      }
    },
    cancel() {
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
