/**
 * เชื่อมต่อ Discord ด้วยการกดปุ่มเดียว (OAuth2) — ลูกค้าไม่ต้องกรอกชื่อผู้ใช้เอง
 *
 * ของเดิมให้ลูกค้าเข้าเซิร์ฟเวอร์เองก่อน แล้วพิมพ์ชื่อผู้ใช้ Discord มาให้ระบบไปค้นหา
 * ซึ่งพลาดได้หลายทาง: พิมพ์ชื่อเล่น (display name) แทนชื่อผู้ใช้, พิมพ์ผิดตัวเดียว,
 * ยังไม่เข้าเซิร์ฟเวอร์, หรือมีคนชื่อคล้ายกันหลายคนจนระบบเลือกไม่ได้
 * ทางนี้ Discord เป็นคนบอกเราเองว่าเป็นใคร จึงไม่มีทางผิดคน
 *
 * ขอสองสิทธิ์:
 *   identify    — รู้ว่าเป็นบัญชีไหน (ไม่ได้อีเมล ไม่ต้องขอ)
 *   guilds.join — พาเข้าเซิร์ฟเวอร์ให้เลย ไม่ต้องไปกดลิงก์เชิญอีกขั้น
 *
 * ต้องตั้ง env เพิ่มสองตัว (หาได้ที่ https://discord.com/developers/applications
 * -> เลือกแอปของบอท -> OAuth2):
 *   DISCORD_CLIENT_ID      — ไม่ใช่ความลับ
 *   DISCORD_CLIENT_SECRET  — ความลับ
 * และต้องใส่ Redirect URL ในหน้า OAuth2 ให้ตรงกับ redirectUri() ด้านล่างเป๊ะ ๆ
 * (Discord ปฏิเสธถ้าไม่ตรงแม้แต่ / ท้ายสุด)
 *
 * ฝั่งเซิร์ฟเวอร์ Discord: บอทต้องมีสิทธิ์ Create Invite ด้วย ไม่ใช่แค่ Manage Roles
 * ไม่งั้น guilds.join จะถูกปฏิเสธ
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API = "https://discord.com/api/v10";

export const discordOAuthEnabled = Boolean(CLIENT_ID && CLIENT_SECRET && GUILD_ID && BOT_TOKEN);

/** ปลายทางที่ Discord ส่งลูกค้ากลับมา — ต้องตรงกับที่ลงทะเบียนไว้ในหน้า OAuth2 */
export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/discord/callback`;
}

/* ------------------------------------------------------------------ */
/* state — กันคนหลอกให้เหยื่อผูก Discord ของคนอื่นเข้าบัญชีตัวเอง (CSRF)  */
/* ------------------------------------------------------------------ */

const STATE_TTL_MS = 10 * 60 * 1000;

function stateKey(): string {
  // ใช้ความลับที่มีอยู่แล้ว ไม่ต้องให้เจ้าของไปตั้ง env เพิ่มอีกตัว
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("ต้องตั้ง NEXTAUTH_SECRET ก่อนใช้การเชื่อมต่อ Discord");
  return secret;
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const mac = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

/** คืน userId เมื่อ state ถูกต้องและยังไม่หมดอายุ ไม่งั้นคืน null */
export function verifyState(state: string): string | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;

  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [userId, issuedAt] = payload.split(".");
  if (!userId || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
  return userId;
}

/* ------------------------------------------------------------------ */
/* ขั้นตอน OAuth                                                       */
/* ------------------------------------------------------------------ */

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "identify guilds.join",
    state,
    // ให้ลูกค้าเห็นหน้ายืนยันทุกครั้ง ไม่ข้ามเงียบ ๆ — เขาควรรู้ว่ากำลังให้สิทธิ์อะไร
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

export interface DiscordIdentity {
  id: string;
  username: string;
  displayName: string;
}

/** แลก code เป็น access token ของลูกค้า (ใช้ครั้งเดียวแล้วทิ้ง ไม่เก็บลงฐานข้อมูล) */
async function exchangeCode(code: string): Promise<string | null> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) {
    console.error("discord token exchange failed:", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function fetchIdentity(accessToken: string): Promise<DiscordIdentity | null> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; username: string; global_name?: string | null };
  return { id: u.id, username: u.username, displayName: u.global_name ?? u.username };
}

/**
 * พาเข้าเซิร์ฟเวอร์ให้เลย พร้อมติดยศมาตั้งแต่ตอนเข้า
 * 201 = เพิ่งเข้า, 204 = อยู่ในเซิร์ฟเวอร์อยู่แล้ว (ทั้งสองถือว่าสำเร็จ)
 * คนที่อยู่แล้วจะไม่ได้ยศจากตรงนี้ — ผู้เรียกต้อง syncDiscordRoles ต่อเองอีกที
 */
async function joinGuild(discordUserId: string, accessToken: string, roles: string[]): Promise<boolean> {
  const res = await fetch(`${API}/guilds/${GUILD_ID}/members/${discordUserId}`, {
    method: "PUT",
    headers: { authorization: `Bot ${BOT_TOKEN}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ access_token: accessToken, ...(roles.length > 0 ? { roles } : {}) }),
  });
  if (res.ok) return true;
  console.error("discord guilds.join failed:", res.status, (await res.text()).slice(0, 300));
  return false;
}

export interface DiscordConnectResult {
  identity: DiscordIdentity;
  /** เข้าเซิร์ฟเวอร์สำเร็จหรือไม่ (รวมกรณีอยู่ในเซิร์ฟเวอร์อยู่แล้ว) */
  joined: boolean;
}

/**
 * ทำครบในขั้นตอนเดียว: รู้ว่าเป็นใคร + พาเข้าเซิร์ฟเวอร์
 * ยศให้ผู้เรียกจัดการต่อด้วย syncDiscordRoles เพื่อไม่ให้ตรรกะยศกระจายสองที่
 */
export async function connectWithCode(code: string, roles: string[] = []): Promise<DiscordConnectResult | null> {
  const token = await exchangeCode(code);
  if (!token) return null;

  const identity = await fetchIdentity(token);
  if (!identity) return null;

  const joined = await joinGuild(identity.id, token, roles);
  return { identity, joined };
}
