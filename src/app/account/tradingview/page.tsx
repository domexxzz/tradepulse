import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TradingViewForm } from "@/components/account/TradingViewForm";

export default async function TradingViewPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({ where: { id: session!.user.id } });
  const grant = await prisma.accessGrant.findFirst({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });

  const statusText: Record<string, string> = {
    PENDING: "รอแอดมินอนุมัติสิทธิ์",
    GRANTED: "ได้รับสิทธิ์แล้ว",
    REVOKED: "สิทธิ์ถูกยกเลิก",
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">เชื่อมต่อ TradingView</h1>
        <p className="mt-1 text-sm text-muted">
          กรอก Username บน TradingView เพื่อให้แอดมินเพิ่มสิทธิ์ใช้งานอินดิเคเตอร์ (invite-only)
        </p>
      </div>

      <TradingViewForm current={user?.tradingViewUsername ?? ""} />

      {grant && (
        <div className="card-surface rounded-2xl p-5">
          <div className="text-sm text-muted">สถานะสิทธิ์ล่าสุด</div>
          <div className="mt-1 font-semibold">{statusText[grant.status] ?? grant.status}</div>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-surface-2/50 p-4 text-xs text-muted">
        วิธีหา Username: เข้า TradingView แล้วคลิกโปรไฟล์มุมขวาบน ชื่อที่ขึ้นต้นด้วย @ คือ username ของคุณ
      </div>
    </div>
  );
}
