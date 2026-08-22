import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ตรวจว่า env ตัวไหนมาถึง runtime แล้วบ้าง
 * รายงานเฉพาะ "ตั้งแล้ว/ยังไม่ตั้ง" — ไม่ส่งค่าจริงออกไปเด็ดขาด
 * ใช้ตอน debug การ deploy แล้วลบทิ้งได้
 */
const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "TRADINGVIEW_WEBHOOK_SECRET",
  "ADMIN_EMAILS",
] as const;

export function GET() {
  const env: Record<string, boolean> = {};
  for (const k of KEYS) env[k] = Boolean(process.env[k]);

  return NextResponse.json(
    {
      env,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
