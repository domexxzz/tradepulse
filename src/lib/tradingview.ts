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
import { prisma } from "@/lib/prisma";

const BOT_URL = process.env.TV_BOT_URL?.replace(/\/$/, "");
/** บริดจ์สำรอง (คอมเบส) — ใช้อัตโนมัติถ้าตัวหลักติดต่อไม่ได้ ถ้าไม่ตั้งก็ไม่มี fallback */
const BOT_URL_BACKUP = process.env.TV_BOT_URL_BACKUP?.replace(/\/$/, "");
const BOT_SECRET = process.env.TV_BOT_SECRET;

/** เปิดใช้การให้สิทธิ์อัตโนมัติแล้วหรือยัง */
export const tvAutoGrantEnabled = Boolean(BOT_URL && BOT_SECRET);

export type BridgeRole = "primary" | "backup";

/** รายงานตัวเข้ามาไม่เกินนี้ถือว่ายังใช้ได้ — keeper รายงานทุก 5 นาที เผื่อพลาดได้สองรอบ */
export const BRIDGE_FRESH_MS = 15 * 60_000;

/**
 * URL ที่บอทรายงานเข้ามาได้ต้องเป็น tunnel ที่เราใช้จริงเท่านั้น
 * กันคนถือ secret ชี้เว็บไปยิงที่อยู่ภายใน หรือโดเมนอื่นที่ไม่ใช่เครื่องบอท
 */
export function normalizeBridgeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (!/^[a-z0-9-]+\.trycloudflare\.com$/.test(u.hostname) && !/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(u.hostname)) {
    return null;
  }
  return u.origin;
}

/**
 * URL ที่จะยิงจริง — ที่บอทรายงานเข้ามาล่าสุด (ถ้ายังสด) ก่อน env
 * ฐานข้อมูลอ่านไม่ได้ก็ยังใช้ env ต่อได้ ไม่ทำให้การให้สิทธิ์ล้มทั้งระบบ
 */
export async function bridgeUrls(now = Date.now()): Promise<Record<BridgeRole, string | undefined>> {
  const urls: Record<BridgeRole, string | undefined> = { primary: BOT_URL, backup: BOT_URL_BACKUP };
  try {
    const rows = await prisma.bridgeEndpoint.findMany({
      where: { lastSeenAt: { gte: new Date(now - BRIDGE_FRESH_MS) } },
    });
    for (const r of rows) if (r.role === "primary" || r.role === "backup") urls[r.role] = r.url;
  } catch (e) {
    console.error("bridgeUrls: read failed, using env", e);
  }
  return urls;
}

/**
 * คิวค้างในบอทตอนนี้กี่งาน — คืน null เมื่อถามไม่ได้ (บอทเงียบหรือกำลังทำงาน)
 *
 * มีไว้ให้ reconcile รู้ว่า "สั่งไปแล้ว" ยังเป็นจริงอยู่ไหม คิวของบอทอยู่ในหน่วยความจำ
 * บอทรีสตาร์ตเมื่อไหร่คิวหายหมด แต่ฝั่งเรายังจำว่าสั่งไปแล้วเลยไม่สั่งซ้ำ
 * งานที่หายไปกับคิวจะค้างจนพ้นเวลากันสั่งซ้ำ ซึ่งลูกค้าต้องรอฟรี ๆ
 */
export async function bridgeQueueDepth(): Promise<number | null> {
  const { primary } = await bridgeUrls();
  if (!primary) return null;
  try {
    const res = await fetch(`${primary}/health`, {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { queue?: unknown };
    return typeof data.queue === "number" ? data.queue : null;
  } catch {
    return null;
  }
}

/** รายชื่อบริดจ์ตามลำดับที่จะลอง (หลักก่อน แล้วค่อยสำรอง) */
async function bridgeTargets(): Promise<string[]> {
  const { primary, backup } = await bridgeUrls();
  return [primary, backup].filter((u): u is string => Boolean(u));
}

/**
 * เช็กว่าบริดจ์ตัวไหนยังมีชีวิต — ใช้โดย cron เฝ้าระวัง
 * คืนสถานะแต่ละตัว (primary/backup) แยกกัน เพื่อให้แจ้งเตือนได้ตรงจุด
 */
/**
 * "ไม่ตอบ" ไม่เท่ากับ "ตาย" — บริดจ์เงียบระหว่างทำงานเป็นเรื่องปกติ
 *
 * ตัวบริดจ์ขับ Chrome ด้วย Selenium ซึ่งเป็นงานแบบบล็อก ระหว่างเพิ่มสิทธิ์ให้ลูกค้า
 * (ราว 90 วินาทีต่อคน) มันจะไม่ตอบ /health เลย ถ้าตีว่าตายทันที จะเตือนผิด
 * บ่อยที่สุดในจังหวะที่ระบบทำงานหนักที่สุด — คือตอนลูกค้ากำลังซื้อ
 * แล้วเจ้าของจะเลิกอ่านแจ้งเตือนไปเลย ซึ่งอันตรายกว่าไม่มีแจ้งเตือน
 * (เจอจริง 30 ก.ย. 69 — เตือนว่าบริดจ์ล่มทั้งที่กำลังเพิ่มสิทธิ์ให้ลูกค้าอยู่)
 *
 * botkeeper บนเครื่องนั้นรายงานตัวเข้ามาทุกนาทีอยู่แล้ว (ตาราง BridgeEndpoint)
 * ถ้าเพิ่งรายงานมา แปลว่าเครื่องยังเปิดและ keeper ยังเดินอยู่
 *
 * ⚠️ แต่ "keeper ยังเดิน" ไม่เท่ากับ "บริดจ์ยังเดิน" — lastSeenAt เขียนโดย keeper
 * ไม่ใช่ตัวบริดจ์ (ดู /api/tradingview/register) และหน้าที่ของ keeper คือรอดแล้ว
 * ปลุกบริดจ์ ดังนั้นตอนบริดจ์ตาย keeper ยิ่งต้องยังอยู่ ถ้าเชื่อ lastSeenAt อย่างเดียว
 * บริดจ์ที่ตายสนิทจะดู "ยังไม่ตาย" ตลอดกาล
 * (เจอจริง 30 ก.ย. 69 — บริดจ์ตาย 13 ชม. คิวค้าง 15 ราย ไม่มีแจ้งเตือนสักครั้ง
 *  ส่วน keeper ก็วน "bridge down -> starting" อยู่เงียบ ๆ เพราะ Chrome ค้างล็อกโปรไฟล์)
 *
 * จึงจำกัดเพดานไว้ด้วย: เงียบได้ แต่เงียบติดกันนานเกินเวลาที่งานหนึ่งชิ้นใช้จริง
 * (90 วินาที/คน คิวยาวสุดที่เคยเจอ ~15 คน) ให้ถือว่าตาย ไม่ว่า keeper จะรายงานดีแค่ไหน
 */
const BRIDGE_BUSY_GRACE_MS = 4 * 60_000;
const BRIDGE_MAX_SILENCE_MS = 30 * 60_000;

export async function checkBridgeHealth(now = Date.now()): Promise<{
  primary: { url: string; up: boolean; busy?: boolean; silentMinutes?: number } | null;
  backup: { url: string; up: boolean; busy?: boolean; silentMinutes?: number } | null;
}> {
  const seen = new Map<string, Date>();
  const silentSince = new Map<string, Date | null>();
  try {
    const rows = await prisma.bridgeEndpoint.findMany();
    for (const r of rows) {
      seen.set(r.role, r.lastSeenAt);
      silentSince.set(r.role, r.unreachableSince);
    }
  } catch (e) {
    console.error("checkBridgeHealth: read lastSeenAt failed", e);
  }

  /** จดว่าเงียบมาตั้งแต่เมื่อไหร่ / ตอบได้แล้ว — ล้มก็ไม่เป็นไร แค่เสียความแม่นรอบเดียว */
  const mark = async (role: BridgeRole, reachable: boolean) => {
    try {
      await prisma.bridgeEndpoint.update({
        where: { role },
        data: { unreachableSince: reachable ? null : (silentSince.get(role) ?? new Date(now)) },
      });
    } catch (e) {
      console.error("checkBridgeHealth: mark failed", e);
    }
  };

  const ping = async (role: BridgeRole, url?: string) => {
    if (!url) return null;
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.ok) {
        await mark(role, true);
        return { url, up: true };
      }
    } catch {
      // ตกมาที่การเช็กว่าเพิ่งรายงานตัวมาหรือเปล่า
    }

    await mark(role, false);

    // เงียบติดกันนานเกินกว่าที่งานจริงใช้ = ตาย ไม่ต้องสนว่า keeper รายงานดีแค่ไหน
    const since = silentSince.get(role);
    if (since && now - since.getTime() > BRIDGE_MAX_SILENCE_MS) {
      return { url, up: false, silentMinutes: Math.round((now - since.getTime()) / 60_000) };
    }

    const last = seen.get(role);
    const recent = Boolean(last && now - last.getTime() <= BRIDGE_BUSY_GRACE_MS);
    return { url, up: recent, busy: recent };
  };

  const urls = await bridgeUrls(now);
  const [primary, backup] = await Promise.all([ping("primary", urls.primary), ping("backup", urls.backup)]);
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
  for (const url of await bridgeTargets()) {
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
