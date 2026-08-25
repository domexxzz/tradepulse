/**
 * ให้/ถอนสิทธิ์สคริปต์ invite-only บน TradingView ผ่านบอทภายนอก
 *
 * TradingView ไม่มี public API สำหรับเรื่องนี้ วิธีที่ใช้กันคือบอทที่ล็อกอินบัญชีเจ้าของสคริปต์
 * แล้วกดเพิ่ม/ลบ username ให้ — บอทตัวนั้นอยู่คนละที่กับเว็บนี้ เราคุยกันผ่าน HTTP
 *
 * ยังไม่ตั้ง env = ระบบทำงานแบบเดิมทุกอย่าง (แอดมินกดอนุมัติเองในคิว)
 * ตั้งแล้ว = ระบบยิงไปหาบอทให้อัตโนมัติ และถ้าบอทล่มก็ตกกลับไปเข้าคิวให้แอดมินทำมือ
 *
 * สัญญาการเรียก (ดู docs/TRADINGVIEW.md):
 *   POST {TV_BOT_URL}/grant   {"secret": "...", "username": "someone", "days": 30}
 *   POST {TV_BOT_URL}/revoke  {"secret": "...", "username": "someone"}
 *   ตอบกลับ: {"ok": true, "queued": true} หรือ {"ok": false, "error": "เหตุผล"}
 *
 * บอทกดหน้าเว็บ TradingView จริงผ่าน Selenium ซึ่งใช้เวลา 60-120 วินาที
 * จึงตอบ queued=true กลับมาก่อน แล้วค่อยยิงผลจริงมาที่ /api/tradingview/callback
 * เราจึงถือว่า ok=true แปลว่า "ส่งคำสั่งถึงบอทแล้ว" ไม่ใช่ "ให้สิทธิ์เสร็จแล้ว"
 */
const BOT_URL = process.env.TV_BOT_URL?.replace(/\/$/, "");
const BOT_SECRET = process.env.TV_BOT_SECRET;

/** เปิดใช้การให้สิทธิ์อัตโนมัติแล้วหรือยัง */
export const tvAutoGrantEnabled = Boolean(BOT_URL && BOT_SECRET);

export interface TvResult {
  ok: boolean;
  /** true = ยังไม่ได้ตั้งค่าบอท ไม่ใช่ความผิดพลาด */
  skipped?: boolean;
  /** true = บอทรับงานเข้าคิวแล้ว ผลจริงจะตามมาทาง callback */
  queued?: boolean;
  reason?: string;
}

async function callBot(path: "grant" | "revoke", body: Record<string, unknown>): Promise<TvResult> {
  if (!tvAutoGrantEnabled) return { ok: false, skipped: true, reason: "ยังไม่ได้ตั้งค่าบอท TradingView" };

  try {
    const res = await fetch(`${BOT_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: BOT_SECRET, ...body }),
      // บอทแค่รับงานเข้าคิวแล้วตอบทันที ไม่ได้ยืนรอ Selenium ทำงานจบ
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; queued?: boolean; error?: string }
      | null;

    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.error ?? `บอทตอบกลับ ${res.status}` };
    }
    return { ok: true, queued: Boolean(data.queued) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "ติดต่อบอทไม่ได้" };
  }
}

/** เพิ่ม username เข้าสคริปต์ (days = จำนวนวันที่ให้สิทธิ์ ไม่ส่งไปคือไม่จำกัด) */
export function grantTradingViewAccess(username: string, days?: number): Promise<TvResult> {
  return callBot("grant", days ? { username, days } : { username });
}

/** ถอน username ออกจากสคริปต์ */
export function revokeTradingViewAccess(username: string): Promise<TvResult> {
  return callBot("revoke", { username });
}
