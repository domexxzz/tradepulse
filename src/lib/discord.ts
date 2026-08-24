/**
 * ให้ยศ (role) ในเซิร์ฟเวอร์ Discord ตามแพ็กเกจที่สมาชิกสมัคร
 * ค่าทั้งหมดมาจาก env — ห้าม hardcode token
 *
 * ต้องตั้งค่าฝั่ง Discord ก่อน: สร้างบอท, เชิญเข้าเซิร์ฟเวอร์, ให้สิทธิ์ Manage Roles
 * และลากยศของบอทให้อยู่ "เหนือ" ยศที่ต้องการแจก มิฉะนั้น Discord จะปฏิเสธ
 */
import type { PlanInterval } from "@/config/plans";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API = "https://discord.com/api/v10";

/** ยศพื้นฐานที่สมาชิกทุกแพ็กเกจได้ (ใช้เปิดห้องเฉพาะสมาชิก) */
const ROLE_MEMBER = process.env.DISCORD_ROLE_MEMBER;

/** ยศแยกตามแพ็กเกจ — ไม่ตั้งค่าก็ได้ ระบบจะข้ามเฉพาะตัวที่ว่าง */
const PLAN_ROLES: Record<PlanInterval, string | undefined> = {
  MONTH: process.env.DISCORD_ROLE_MONTH,
  Q3: process.env.DISCORD_ROLE_Q3,
  H6: process.env.DISCORD_ROLE_H6,
  YEAR: process.env.DISCORD_ROLE_YEAR,
};

export const discordBotEnabled = Boolean(TOKEN && GUILD_ID);

/** ยศทั้งหมดที่ระบบดูแล ใช้ตอนถอนสิทธิ์ */
function managedRoles(): string[] {
  return [ROLE_MEMBER, ...Object.values(PLAN_ROLES)].filter(Boolean) as string[];
}

async function api(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export interface GuildMember {
  id: string;
  username: string;
  displayName: string;
}

/**
 * หาสมาชิกในเซิร์ฟเวอร์จาก Discord user ID (ตัวเลขล้วน) หรือจากชื่อผู้ใช้
 * คืน null เมื่อไม่พบ — แปลว่ายังไม่ได้เข้าเซิร์ฟเวอร์ หรือพิมพ์ชื่อผิด
 */
export async function findGuildMember(query: string): Promise<GuildMember | null> {
  if (!discordBotEnabled) return null;
  const q = query.trim().replace(/^@/, "");
  if (!q) return null;

  // ตัวเลขล้วน = Discord user ID ดึงตรงได้เลย
  if (/^\d{15,25}$/.test(q)) {
    const res = await api(`/guilds/${GUILD_ID}/members/${q}`);
    if (!res.ok) return null;
    const m = await res.json();
    return { id: m.user.id, username: m.user.username, displayName: m.nick ?? m.user.global_name ?? m.user.username };
  }

  // ไม่ใช่ตัวเลข = ค้นจากชื่อผู้ใช้ในเซิร์ฟเวอร์
  const res = await api(`/guilds/${GUILD_ID}/members/search?query=${encodeURIComponent(q)}&limit=10`);
  if (!res.ok) return null;
  const list: Array<{ user: { id: string; username: string; global_name?: string }; nick?: string }> =
    await res.json();

  const exact = list.find(
    (m) => m.user.username.toLowerCase() === q.toLowerCase()
  );
  const picked = exact ?? (list.length === 1 ? list[0] : null);
  if (!picked) return null;

  return {
    id: picked.user.id,
    username: picked.user.username,
    displayName: picked.nick ?? picked.user.global_name ?? picked.user.username,
  };
}

async function setRole(discordUserId: string, roleId: string, on: boolean) {
  const res = await api(`/guilds/${GUILD_ID}/members/${discordUserId}/roles/${roleId}`, {
    method: on ? "PUT" : "DELETE",
  });
  // 204 = สำเร็จ, 404 ตอนถอน = ไม่มียศอยู่แล้ว ถือว่าผ่าน
  return res.ok || (!on && res.status === 404);
}

export interface RoleSyncResult {
  ok: boolean;
  reason?: string;
  granted?: string[];
}

/**
 * ให้ยศตามแพ็กเกจ — เพิ่มยศสมาชิกและยศของแพ็กเกจปัจจุบัน
 * พร้อมถอนยศแพ็กเกจอื่นออก เพื่อไม่ให้ค้างเมื่อเปลี่ยนแพ็กเกจ
 */
export async function syncDiscordRoles(
  discordUserId: string,
  planCode: PlanInterval
): Promise<RoleSyncResult> {
  if (!discordBotEnabled) return { ok: false, reason: "ยังไม่ได้ตั้งค่าบอท Discord" };

  const keep = [ROLE_MEMBER, PLAN_ROLES[planCode]].filter(Boolean) as string[];
  if (keep.length === 0) return { ok: false, reason: "ยังไม่ได้ตั้งค่ารหัสยศใน env" };

  const granted: string[] = [];
  for (const roleId of keep) {
    if (await setRole(discordUserId, roleId, true)) granted.push(roleId);
  }

  // ถอนยศแพ็กเกจอื่นที่ไม่ใช่ของรอบนี้
  for (const roleId of managedRoles()) {
    if (!keep.includes(roleId)) await setRole(discordUserId, roleId, false);
  }

  return granted.length > 0
    ? { ok: true, granted }
    : { ok: false, reason: "Discord ปฏิเสธการให้ยศ — ตรวจสิทธิ์ Manage Roles และลำดับยศของบอท" };
}

/** ถอนยศทั้งหมดที่ระบบดูแล ใช้ตอนหมดอายุหรือคืนเงิน */
export async function revokeDiscordRoles(discordUserId: string): Promise<RoleSyncResult> {
  if (!discordBotEnabled) return { ok: false, reason: "ยังไม่ได้ตั้งค่าบอท Discord" };
  for (const roleId of managedRoles()) await setRole(discordUserId, roleId, false);
  return { ok: true };
}
