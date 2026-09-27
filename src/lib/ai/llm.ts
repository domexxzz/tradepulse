import { cloudConfigured, cloudModel, localGateway } from "@/lib/ai/gateway";

/**
 * เรียกโมเดลแบบ stream — ใช้ภาษา OpenAI Chat Completions ตัวเดียวกับทุกที่
 * (gateway บนเครื่องบ้าน · Grok · OpenAI ต่างกันแค่ URL, key, ชื่อโมเดล)
 *
 * ลำดับ: เครื่องบ้านก่อน (ฟรี) → คลาวด์ (ตัวสำรอง) · สลับเฉพาะตอนที่ "ยังไม่ได้ตอบสักคำ"
 * ถ้าตอบไปครึ่งทางแล้วพัง ไม่สลับ (ลูกค้าจะเห็นคำตอบสองแบบปนกัน) ให้แจ้งพังแทน
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiSource = "local" | "cloud";

export type Provider = {
  source: AiSource;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** รอคำแรกได้นานเท่าไหร่ก่อนเลิกแล้วลองตัวถัดไป */
  firstTokenMs: number;
};

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number };

export type OpenedStream = {
  source: AiSource;
  model: string;
  events: AsyncGenerator<StreamEvent>;
  /** หยุดโมเดลกลางทาง (ลูกค้ากดหยุด/ปิดหน้า) — คืนการ์ดจอให้คนถัดไปทันที */
  abort?: () => void;
};

/** เปิด stream ไปที่โมเดล — ชุดเทสต์ส่งตัวปลอมเข้ามาแทน ไม่ต้องมีเครื่องบ้านหรือเสียค่า API */
export type OpenOptions = {
  /**
   * คำถามวิเคราะห์กราฟสด → ลองคลาวด์ก่อน (ถ้าตั้งไว้) · ทดสอบกับ gemma3:12b บนคอมเบสแล้ว:
   * คำถามความรู้ + RAG ตอบแม่น แต่อ่านกราฟสดพลาดราวครึ่งหนึ่ง (สลับโซน Buy/Sell · บอกราคาอยู่ในโซนทั้งที่ไม่ใช่)
   * ปิดได้ด้วย AI_MARKET_PREFER=local
   */
  preferCloud?: boolean;
};

export type OpenModel = (messages: ChatMessage[], deadline: number, opts?: OpenOptions) => Promise<OpenedStream>;

export class ModelError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const MAX_OUTPUT_TOKENS = 1200;

/** เครื่องบ้านโหลดโมเดลเข้าการ์ดจอครั้งแรกใช้เวลา — ให้รอนานกว่าคลาวด์ */
const LOCAL_FIRST_TOKEN_MS = 25_000;
const CLOUD_FIRST_TOKEN_MS = 20_000;

export async function providers(): Promise<Provider[]> {
  const list: Provider[] = [];
  const local = await localGateway();
  const secret = process.env.TV_BOT_SECRET;
  if (local && secret) {
    list.push({ source: "local", baseUrl: `${local.url}/v1`, apiKey: secret, model: "qvx-local", firstTokenMs: LOCAL_FIRST_TOKEN_MS });
  }
  if (cloudConfigured()) {
    list.push({
      source: "cloud",
      baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      apiKey: process.env.OPENAI_API_KEY!,
      model: cloudModel(),
      firstTokenMs: CLOUD_FIRST_TOKEN_MS,
    });
  }
  return list;
}

/** อ่าน SSE ทีละ event — บรรทัด "data: ..." คั่นด้วยบรรทัดว่าง */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    if (buf.startsWith("data:")) yield buf.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

type ChunkJson = {
  choices?: Array<{ delta?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: unknown;
};

export async function* streamProvider(p: Provider, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${p.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: p.model, messages, stream: true, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.4 }),
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ModelError(`${p.source.toUpperCase()}_UNREACHABLE`);
  }
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`AI_${p.source}_HTTP_${res.status}`, detail);
    throw new ModelError(res.status === 503 ? `${p.source.toUpperCase()}_BUSY` : `${p.source.toUpperCase()}_${res.status}`);
  }
  for await (const data of sseData(res.body)) {
    if (data === "[DONE]") return;
    let obj: ChunkJson;
    try {
      obj = JSON.parse(data);
    } catch {
      continue;
    }
    if (obj.error) throw new ModelError(`${p.source.toUpperCase()}_STREAM_ERROR`);
    const text = obj.choices?.[0]?.delta?.content;
    if (text) yield { type: "delta", text };
    if (obj.usage) {
      yield { type: "usage", inputTokens: obj.usage.prompt_tokens ?? 0, outputTokens: obj.usage.completion_tokens ?? 0 };
    }
  }
}

/** ต่อ event แรกที่อ่านไปแล้วกลับเข้าหัว stream */
async function* prepend(first: StreamEvent, rest: AsyncGenerator<StreamEvent>): AsyncGenerator<StreamEvent> {
  yield first;
  yield* rest;
}

/**
 * ลองทีละตัวจนกว่าจะได้ "คำแรก" — ได้แล้วถือว่าตัวนั้นเป็นคนตอบ
 * deadline = เวลาสุดท้ายที่ต้องตอบจบ (ms epoch) ให้ทันก่อน Vercel ตัด request
 */
export async function openStreamWith(list: Provider[], messages: ChatMessage[], deadline: number): Promise<OpenedStream> {
  if (!list.length) throw new ModelError("AI_NOT_CONFIGURED");
  let lastCode = "AI_UNAVAILABLE";
  for (const p of list) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    const ctrl = new AbortController();
    const firstTimer = setTimeout(() => ctrl.abort(), Math.min(p.firstTokenMs, remaining));
    const gen = streamProvider(p, messages, ctrl.signal);
    try {
      // ข้าม event usage ที่อาจมาก่อน — ต้องการคำแรกจริง ๆ
      let first = await gen.next();
      while (!first.done && first.value.type !== "delta") first = await gen.next();
      if (first.done) throw new ModelError(`${p.source.toUpperCase()}_EMPTY`);
      clearTimeout(firstTimer);
      // ได้คำแรกแล้ว — เหลือเวลาเท่าไหร่ให้ตอบต่อได้เท่านั้น เกินแล้วตัด
      const totalTimer = setTimeout(() => ctrl.abort(), Math.max(1_000, deadline - Date.now()));
      const guarded = (async function* () {
        try {
          yield* prepend(first.value, gen);
        } catch (e) {
          throw e instanceof ModelError ? e : new ModelError(`${p.source.toUpperCase()}_INTERRUPTED`);
        } finally {
          clearTimeout(totalTimer);
        }
      })();
      return { source: p.source, model: p.model, events: guarded, abort: () => ctrl.abort() };
    } catch (e) {
      clearTimeout(firstTimer);
      // เช็กก่อนสั่ง abort เอง — ถูกตัดเพราะหมดเวลารอคำแรก = TIMEOUT ไม่ใช่ติดต่อไม่ได้
      const timedOut = ctrl.signal.aborted;
      ctrl.abort();
      lastCode = timedOut ? `${p.source.toUpperCase()}_TIMEOUT` : e instanceof ModelError ? e.code : "UNKNOWN";
      console.warn(`AI provider ${p.source} failed before first token: ${lastCode}`);
    }
  }
  throw new ModelError(lastCode);
}

export const openStream: OpenModel = async (messages, deadline, opts) => {
  const list = await providers();
  const cloudFirst = opts?.preferCloud && process.env.AI_MARKET_PREFER !== "local";
  const ordered = cloudFirst ? [...list].sort((a, b) => (a.source === "cloud" ? -1 : 0) - (b.source === "cloud" ? -1 : 0)) : list;
  return openStreamWith(ordered, messages, deadline);
};
