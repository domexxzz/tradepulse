import { AI_DEFAULT_MODEL } from "@/config/ai";
import { QVX_INSTRUCTIONS } from "@/lib/ai/instructions";
import { QVX_KNOWLEDGE } from "@/lib/ai/knowledge";

/**
 * เรียก OpenAI Responses API — แยกไว้ให้ชุดเทสต์สลับเป็นโมเดลปลอมได้ ไม่ต้องจ่ายค่า API จริง
 */

export type ModelInput = { role: "developer" | "user" | "assistant"; content: string };

export type ModelAnswer = {
  answer: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
};

/** ฟังก์ชันที่ตอบคำถาม — ของจริงคือ callOpenAI ชุดเทสต์ส่งตัวปลอมเข้ามาแทน */
export type CallModel = (input: ModelInput[]) => Promise<ModelAnswer>;

export class ModelError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY);

type ResponsesPayload = {
  model?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * ดึงข้อความคำตอบ — REST API ตรง ๆ ไม่มี output_text สำเร็จรูปเสมอไป (อันนั้น SDK ประกอบให้)
 * จึงต้องไล่ประกอบจาก output[].content[] เองเป็นทางสำรอง
 */
export function extractAnswer(payload: ResponsesPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

export const callOpenAI: CallModel = async (input) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ModelError("AI_NOT_CONFIGURED");

  let res: Response;
  try {
    // OPENAI_BASE_URL ไว้ชี้ไป proxy หรือเซิร์ฟเวอร์จำลองตอนทดสอบหน้าแชต — production ไม่ต้องตั้ง
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    res = await fetch(`${base}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || AI_DEFAULT_MODEL,
        // คำสั่งของน็อต (ไม่แตะ) + ความรู้จากคู่มือ QVX
        instructions: `${QVX_INSTRUCTIONS}\n\n${QVX_KNOWLEDGE}`,
        input,
        max_output_tokens: 900,
      }),
      // ต่ำกว่า maxDuration ของ route — หมดเวลาแล้วยังทันบันทึกว่าล้มและคืนโควตา
      signal: AbortSignal.timeout(50_000),
    });
  } catch (e) {
    console.error("OPENAI_FETCH_FAILED", e);
    throw new ModelError("OPENAI_UNREACHABLE");
  }

  if (!res.ok) {
    // เนื้อหา error ไม่มีค่าลับ แต่ตัดให้สั้นกัน log บวม
    console.error("OPENAI_ERROR", res.status, (await res.text()).slice(0, 500));
    throw new ModelError(`OPENAI_${res.status}`);
  }

  const payload = (await res.json()) as ResponsesPayload;
  const answer = extractAnswer(payload);
  if (!answer) throw new ModelError("OPENAI_EMPTY");

  return {
    answer,
    model: payload.model ?? null,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  };
};
