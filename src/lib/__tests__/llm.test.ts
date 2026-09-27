import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { openStreamWith, ModelError } = await import("@/lib/ai/llm");
type Provider = Parameters<typeof openStreamWith>[0][number];

/**
 * ระบบสำรอง — เครื่องบ้านล่ม/ยุ่ง/ช้า ต้องสลับไปคลาวด์เอง ลูกค้าไม่ต้องรู้
 * แต่ถ้าเครื่องบ้านตอบไปแล้วครึ่งทาง ห้ามสลับ (จะได้คำตอบสองแบบปนกัน)
 */

const local: Provider = { source: "local", baseUrl: "https://home.example/v1", apiKey: "k", model: "qvx-local", firstTokenMs: 300 };
const cloud: Provider = { source: "cloud", baseUrl: "https://cloud.example/v1", apiKey: "k", model: "grok", firstTokenMs: 300 };

const sse = (...parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      for (const p of parts) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`));
      c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 9, completion_tokens: 3 } })}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });

async function collect(opened: Awaited<ReturnType<typeof openStreamWith>>) {
  let text = "";
  let usage;
  for await (const ev of opened.events) {
    if (ev.type === "delta") text += ev.text;
    else usage = ev;
  }
  return { text, usage, source: opened.source };
}

const msgs = [{ role: "user" as const, content: "hi" }];
const deadline = () => Date.now() + 30_000;

afterEach(() => vi.unstubAllGlobals());

describe("ลำดับและการสลับตัวสำรอง", () => {
  it("เครื่องบ้านปกติ = ตอบจากเครื่องบ้าน ไม่เรียกคลาวด์", async () => {
    const f = vi.fn(async (url: string) => new Response(sse(url.includes("home") ? "บ้าน" : "คลาวด์")));
    vi.stubGlobal("fetch", f);
    const r = await collect(await openStreamWith([local, cloud], msgs, deadline()));
    expect(r).toMatchObject({ text: "บ้าน", source: "local" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("เครื่องบ้านยุ่ง (503) = สลับไปคลาวด์ทันที", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("home") ? new Response('{"error":"busy"}', { status: 503 }) : new Response(sse("จาก", "คลาวด์")))));
    const r = await collect(await openStreamWith([local, cloud], msgs, deadline()));
    expect(r).toMatchObject({ text: "จากคลาวด์", source: "cloud" });
    expect(r.usage).toMatchObject({ inputTokens: 9, outputTokens: 3 });
  });

  it("เครื่องบ้านติดต่อไม่ได้ (เครื่องดับ) = สลับไปคลาวด์", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("home")) throw new TypeError("fetch failed");
      return new Response(sse("ok"));
    }));
    expect((await collect(await openStreamWith([local, cloud], msgs, deadline()))).source).toBe("cloud");
  });

  it("เครื่องบ้านเงียบเกินเวลารอคำแรก = ตัดแล้วสลับไปคลาวด์", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (!url.includes("home")) return Promise.resolve(new Response(sse("ทัน")));
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }));
    const started = Date.now();
    const r = await collect(await openStreamWith([local, cloud], msgs, deadline()));
    expect(r.source).toBe("cloud");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("พังทั้งสองทาง = แจ้งพัง (ห้องแชตจะคืนโควตา)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    await expect(openStreamWith([local, cloud], msgs, deadline())).rejects.toBeInstanceOf(ModelError);
  });

  it("ไม่มีทางไหนตั้งไว้เลย = AI_NOT_CONFIGURED", async () => {
    await expect(openStreamWith([], msgs, deadline())).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });

  it("ตอบไปครึ่งทางแล้วพัง = ไม่สลับ แจ้งพังกลางทาง", async () => {
    // ส่งคำแรกให้ก่อน แล้วค่อยพังตอนอ่านรอบถัดไป (error ทันทีจะทิ้งคำที่ค้างคิวไปด้วย)
    const broken = () => {
      let reads = 0;
      return new ReadableStream<Uint8Array>({
        pull(c) {
          if (reads++ === 0) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "ครึ่ง" } }] })}\n\n`));
          else c.error(new Error("connection reset"));
        },
      });
    };
    const f = vi.fn(async () => new Response(broken()));
    vi.stubGlobal("fetch", f);
    const opened = await openStreamWith([local, cloud], msgs, deadline());
    await expect(collect(opened)).rejects.toBeInstanceOf(ModelError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
