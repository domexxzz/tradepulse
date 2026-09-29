import { providers } from "@/lib/ai/llm";

/**
 * ให้ AI อ่านตัวเลขบนสลิป — ใช้แทน EasySlip ตอนที่ยังไม่มีบัญชีผู้ให้บริการ
 *
 * ⚠️ อ่านได้ ≠ ยืนยันได้ AI มองเห็นแค่พิกเซลบนภาพ ถ้าใครแก้ตัวเลขด้วยแอปแต่งรูป
 * AI จะอ่านตามที่แก้อย่างซื่อสัตย์ ต่างจาก EasySlip ที่เอาเลขอ้างอิงไปถามธนาคาร
 * ว่ารายการนี้มีจริงไหม ยอดเท่าไร เข้าบัญชีไหน
 *
 * จึงต้องใช้คู่กับด่านอื่นเสมอ (checksum ของ QR + กันสลิปซ้ำ + เทียบบัญชีปลายทาง)
 * และห้ามถือว่าผลจากตัวนี้เท่ากับผลจาก EasySlip
 *
 * ขอค่าเป็น JSON ล้วน เพราะต้องเอาไปเทียบตัวเลข ไม่ใช่ให้คนอ่าน
 * โมเดลตอบนอกรูปแบบเมื่อไหร่ถือว่าอ่านไม่ได้ ดีกว่าเดาความหมายเอง
 */

export interface SlipReadResult {
  ok: boolean;
  /** ยอดเงินที่อ่านได้ (บาท) */
  amount?: number;
  /** ชื่อผู้รับที่พิมพ์อยู่บนสลิป */
  receiverName?: string;
  /** เลขบัญชี/พร้อมเพย์ผู้รับ ตามที่เห็น (มักถูกปิดบางหลักด้วย x) */
  receiverAccount?: string;
  /** วันเวลาที่โอน ตามที่เห็นบนสลิป */
  transferredAt?: string;
  /** โมเดลที่ใช้อ่าน — ไว้ดูตอนผลเพี้ยน */
  model?: string;
  reason?: string;
}

const PROMPT = `คุณกำลังอ่าน "สลิปโอนเงิน" ของธนาคารไทย
ตอบกลับเป็น JSON ล้วนเท่านั้น ห้ามมีข้อความอื่นและห้ามใส่ markdown

{
  "amount": ตัวเลขยอดเงินที่โอน หน่วยบาท ไม่ต้องมีคอมมา เช่น 999 หรือ 1290.5,
  "receiverName": "ชื่อผู้รับเงินตามที่พิมพ์บนสลิป",
  "receiverAccount": "เลขบัญชีหรือพร้อมเพย์ของผู้รับ ตามที่เห็น รวมเครื่องหมายปิดบัง เช่น xxx-x-x1234-5",
  "transferredAt": "วันเวลาที่โอน ตามที่เห็นบนสลิป"
}

กติกา
- อ่านเฉพาะสิ่งที่เห็นจริงบนภาพ ห้ามเดาและห้ามเติมเอง
- ช่องไหนอ่านไม่ออกให้ใส่ null
- "ผู้รับ" คือปลายทางที่เงินเข้า ไม่ใช่ผู้โอน ระวังสลับกัน`;

/** ดึง JSON ออกจากคำตอบ เผื่อโมเดลใส่ markdown มาด้วยแม้จะสั่งห้ามแล้ว */
function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s฿]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * ส่งรูปสลิปให้โมเดลที่อ่านภาพได้
 *
 * ไล่ตามลำดับเดียวกับที่ระบบ AI ใช้อยู่ (เครื่องบ้านก่อน แล้วค่อยคลาวด์)
 * เครื่องบ้านบางรุ่นอ่านภาพไม่ได้ ถ้าตอบไม่ได้ก็ตกไปตัวถัดไปเอง
 */
export async function readSlipWithAi(input: {
  base64: string;
  mime: string;
}): Promise<SlipReadResult> {
  const list = await providers();
  if (list.length === 0) return { ok: false, reason: "ยังไม่ได้ตั้งค่า AI" };

  const dataUrl = `data:${input.mime};base64,${input.base64}`;
  let lastReason = "ไม่มีโมเดลที่อ่านภาพได้";

  for (const p of list) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: { authorization: `Bearer ${p.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          // ตอบสั้น ๆ พอ ถ้าปล่อยยาวโมเดลจะเริ่มอธิบายแทนที่จะตอบ JSON
          max_tokens: 400,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        lastReason = `${p.source} ตอบ ${res.status}`;
        continue;
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      const data = parseJson(text);
      if (!data) {
        lastReason = `${p.source} ตอบไม่เป็น JSON`;
        continue;
      }

      const amount = num(data.amount);
      if (amount === undefined) {
        lastReason = `${p.source} อ่านยอดเงินไม่ได้`;
        continue;
      }

      return {
        ok: true,
        amount,
        receiverName: str(data.receiverName),
        receiverAccount: str(data.receiverAccount),
        transferredAt: str(data.transferredAt),
        model: `${p.source}:${p.model}`,
      };
    } catch (e) {
      lastReason = `${p.source} ล้มเหลว: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return { ok: false, reason: lastReason };
}
