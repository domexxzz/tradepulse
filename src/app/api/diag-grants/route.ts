import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ⚠️ Endpoint วินิจฉัยชั่วคราว — อ่านอย่างเดียว ลบทิ้งหลังใช้
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAG_TOKEN = "dx3AtAIlCQkUO3s1OKuw1ktFBd_LWrYc";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== DIAG_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const grants = await prisma.accessGrant.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      status: true,
      note: true,
      grantedAt: true,
      revokedAt: true,
      createdAt: true,
      tradingViewUsername: true,
      user: { select: { email: true, tradingViewUsername: true } },
    },
  });
  return NextResponse.json({ count: grants.length, grants });
}
