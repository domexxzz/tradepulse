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
/** บริดจ์สำรอง (คอมเบส) — ใช้อัตโนมัติถ้าตัวหลักติดต่อไม่ได้ ถ้าไม่ตั้งก็ไม่มี fallback */
const BOT_URL_BACKUP = process.env.TV_BOT_URL_BACKUP?.replace(/\/$/, "");
const BOT_SECRET = process.env.TV_BOT_SECRET;

/** เปิดใช้การให้สิทธิ์อัตโนมัติแล้วหรือยัง */
export const tvAutoGrantEnabled = Boolean(BOT_URL && BOT_SECRET);

/** รายชื่อบริดจ์ตามลำดับที่จะลอง (หลักก่อน แล้วค่อยสำรอง) */
const bridgeTargets = () => [BOT_URL, BOT_URL_BACKUP].filter((u): u is string => Boolean(u));

/**
 * เช็กว่าบริดจ์ตัวไหนยังมีชีวิต — ใช้โดย cron เฝ้าระวัง
 * คืนสถานะแต่ละตัว (primary/backup) แยกกัน เพื่อให้แจ้งเตือนได้ตรงจุด
 */
export async function checkBridgeHealth(): Promise<{
  primary: { url: string; up: boolean } | null;
  backup: { url: string; up: boolean } | null;
}> {
  const ping = async (url?: string) => {
    if (!url) return null;
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      return { url, up: res.ok };
    } catch {
      return { url, up: false };
    }
  };
  const [primary, backup] = await Promise.all([ping(BOT_URL), ping(BOT_URL_BACKUP)]);
  return { primary, backup };
}

export interface TvResult {
  ok: boolean;
  /** true = ยังไม่ได้ตั้งค่าบอท ไม่ใช่ความผิดพลาด */
  skipped?: boolean;
  /** true = บอทรับงานเข้าคิวแล้ว ผลจริงจะตามมาทาง callback */
  queued?: boolean;
  reason?: string;
}

/** ยิงคำสั่งไปบริดจ์ตัวเดียว — คืน null ถ้าติดต่อไม่ได้เลย (เพื่อให้ fallback ไปตัวถัดไป) */
async function callOne(
  url: string,
  path: "grant" | "revoke",
  body: Record<string, unknown>
): Promise<TvResult | null> {
  try {
    const res = await fetch(`${url}/${path}`, {
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
      // บริดจ์ตอบกลับมาแต่ปฏิเสธงาน = ความผิดพลาดจริง ไม่ใช่ "ติดต่อไม่ได้" จึงไม่ fallback
      return { ok: false, reason: data?.error ?? `บอทตอบกลับ ${res.status}` };
    }
    return { ok: true, queued: Boolean(data.queued) };
  } catch {
    // timeout / เชื่อมต่อไม่ได้ = ตัวนี้ล่ม ลองตัวถัดไป
    return null;
  }
}

async function callBot(path: "grant" | "revoke", body: Record<string, unknown>): Promise<TvResult> {
  if (!tvAutoGrantEnabled) return { ok: false, skipped: true, reason: "ยังไม่ได้ตั้งค่าบอท TradingView" };

  // ลองบริดจ์หลักก่อน ถ้าติดต่อไม่ได้เลยค่อยตกไปบริดจ์สำรอง (คอมเบส)
  // ถ้าบริดจ์ตอบมาแต่ปฏิเสธงาน ถือเป็นผลจริง ไม่ต้องลองซ้ำ (กันสั่งซ้ำ 2 เครื่อง)
  for (const url of bridgeTargets()) {
    const res = await callOne(url, path, body);
    if (res) return res;
  }
  return { ok: false, reason: "ติดต่อบอทไม่ได้ทั้งตัวหลักและตัวสำรอง" };
}

/** เพิ่ม username เข้าสคริปต์ (days = จำนวนวันที่ให้สิทธิ์ ไม่ส่งไปคือไม่จำกัด) */
export function grantTradingViewAccess(username: string, days?: number): Promise<TvResult> {
  return callBot("grant", days ? { username, days } : { username });
}

/** ถอน username ออกจากสคริปต์ */
export function revokeTradingViewAccess(username: string): Promise<TvResult> {
  return callBot("revoke", { username });
}
