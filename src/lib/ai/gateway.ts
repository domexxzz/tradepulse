import { prisma } from "@/lib/prisma";
import { AI_DEFAULT_MODEL } from "@/config/ai";

/**
 * AI บนเครื่องบ้าน (คอมเบส) — keeper บนเครื่องนั้นรายงาน URL ของ gateway เข้ามาทุกนาที
 * ผ่าน /api/tradingview/register (role "ai") ใช้ตาราง BridgeEndpoint ร่วมกับบอท
 *
 * นับว่าใช้ได้เมื่อรายงานเข้ามาไม่เกิน 5 นาที — สั้นกว่าบอท (15 นาที) เพราะถ้าเครื่องดับ
 * ต้องรีบเลิกยิงไปหา จะได้ไม่เสียเวลาลูกค้ารอก่อนสลับไปตัวสำรอง
 */
export const AI_LOCAL_FRESH_MS = 5 * 60_000;
export const AI_LOCAL_ROLE = "ai";

export async function localGateway(now = Date.now()): Promise<{ url: string; lastSeenAt: Date } | null> {
  try {
    const row = await prisma.bridgeEndpoint.findUnique({ where: { role: AI_LOCAL_ROLE } });
    if (row && now - row.lastSeenAt.getTime() <= AI_LOCAL_FRESH_MS) return { url: row.url, lastSeenAt: row.lastSeenAt };
  } catch (e) {
    console.error("localGateway: read failed", e);
  }
  return null;
}

export const cloudConfigured = () => Boolean(process.env.OPENAI_API_KEY);
export const cloudModel = () => process.env.OPENAI_MODEL || AI_DEFAULT_MODEL;

export type AiEngineStatus = {
  local: { up: boolean; lastSeenAt: string | null };
  cloud: { configured: boolean };
  /** มีอย่างน้อยหนึ่งทางที่ตอบได้ */
  available: boolean;
};

export async function aiEngineStatus(now = Date.now()): Promise<AiEngineStatus> {
  const local = await localGateway(now);
  const cloud = cloudConfigured();
  return {
    local: { up: Boolean(local), lastSeenAt: local?.lastSeenAt.toISOString() ?? null },
    cloud: { configured: cloud },
    available: Boolean(local) || cloud,
  };
}
