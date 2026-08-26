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
    PENDING: "กำลังดำเนินการเพิ่มสิทธิ์ให้",
    PENDING_REVOKE: "หมดอายุ — กำลังถอนสิทธิ์",
    GRANTED: "ได้รับสิทธิ์แล้ว ใช้งานบน TradingView ได้เลย",
    REVOKED: "สิทธิ์ถูกยกเลิก (ต่ออายุเพื่อใช้งานต่อ)",
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">เชื่อมต่อ TradingView</h1>
        <p className="mt-1 text-sm text-muted">
          กรอก Username บน TradingView เพื่อรับสิทธิ์ใช้งานอินดิเคเตอร์ (invite-only)
          — สิทธิ์จะถูกเพิ่มให้หลังยืนยันการชำระเงิน
        </p>
      </div>

      <TradingViewForm current={user?.tradingViewUsername ?? ""} />

      {grant && (
        <div className="card-surface rounded-xl p-5">
          <div className="text-sm text-muted">สถานะสิทธิ์ล่าสุด</div>
          <div className="mt-1 font-semibold">{statusText[grant.status] ?? grant.status}</div>
          {grant.status === "PENDING" && (
            <p className="mt-1.5 text-xs text-muted">
              ปกติไม่เกิน 24 ชั่วโมง — ถ้านานกว่านั้นแจ้งทีมงานได้ที่หน้าช่วยเหลือ
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs text-muted">
        วิธีหา Username: เข้า TradingView แล้วคลิกโปรไฟล์มุมขวาบน ชื่อที่ขึ้นต้นด้วย @ คือ username ของคุณ
      </div>
    </div>
  );
}
