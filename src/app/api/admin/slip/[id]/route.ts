import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * ส่งรูปสลิปให้แอดมินดู (เฉพาะ role ADMIN)
 *
 * แยกรูปออกมาเป็นเส้นทางของตัวเอง เพื่อให้หน้ารายการออเดอร์ไม่ต้องดึง base64
 * ของทุกออเดอร์มาพร้อมกัน — หน้าเดียวเคยหนักเป็นสิบเมกะไบต์เพราะเรื่องนี้
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const order = await prisma.slipOrder.findUnique({
    where: { id },
    select: { slipData: true, slipMime: true },
  });

  const match = order?.slipData ? /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(order.slipData) : null;
  if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": order?.slipMime ?? match[1],
      // สลิปเป็นข้อมูลส่วนบุคคล ห้าม CDN หรือเบราว์เซอร์เก็บไว้แชร์ต่อ
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="slip-${id}.jpg"`,
    },
  });
}
