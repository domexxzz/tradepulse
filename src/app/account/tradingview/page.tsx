import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TradingViewForm } from "@/components/account/TradingViewForm";
import { MAX_FAILS } from "@/lib/reconcile";

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

  /**
   * บอกลูกค้าตรง ๆ เมื่อชื่อที่กรอกใช้ไม่ได้ — มีแต่เขาเท่านั้นที่แก้ได้
   *
   * ของเดิมหน้านี้ขึ้นว่า "กำลังดำเนินการ — ปกติไม่เกิน 24 ชั่วโมง" ทุกกรณีที่สถานะ
   * เป็น PENDING รวมถึงตอนที่ชื่อนั้นไม่มีอยู่จริงบน TradingView ซึ่งรออีกกี่วันก็
   * ไม่มีอะไรเกิดขึ้น ลูกค้าจ่ายเงินแล้วนั่งรอของที่ไม่มีวันมา โดยที่หน้าเว็บเป็นคน
   * บอกให้รอเอง (เจอจริง 10 ต.ค. 69 สองราย — ระบบส่งอีเมลบอกแล้วแต่หน้าเว็บยังบอกให้รอ)
   */
  const failed = grant?.status === "PENDING" && grant.failCount > 0;
  const nameNotFound = failed && /ไม่พบ\s*username|not\s*found|ไม่มีผู้ใช้/i.test(grant?.lastFailReason ?? "");
  const gaveUp = failed && grant!.failCount >= MAX_FAILS;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">เชื่อมต่อ TradingView</h1>
        <p className="mt-1 text-sm text-muted">
          กรอก Username บน TradingView เพื่อรับสิทธิ์ใช้งานอินดิเคเตอร์ (invite-only)
          — สิทธิ์จะถูกเพิ่มให้หลังยืนยันการชำระเงิน
        </p>
      </div>

      {nameNotFound && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="font-semibold text-amber-200">
            ชื่อ “{user?.tradingViewUsername}” ไม่มีอยู่จริงบน TradingView
          </div>
          <p className="mt-1.5 text-sm text-muted">
            เราพยายามเพิ่มสิทธิ์ให้ชื่อนี้แล้วแต่หาบัญชีไม่เจอ จึงยังเพิ่มให้ไม่ได้
            {gaveUp ? " และหยุดลองไว้ก่อนเพื่อไม่ให้คิวของคนอื่นช้าตามไปด้วย" : ""}
          </p>
          <div className="mt-3 text-sm">
            <div className="font-semibold">วิธีแก้ — ใช้เวลาไม่ถึงนาที</div>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-muted">
              <li>เข้า TradingView คลิกรูปโปรไฟล์มุมขวาบน</li>
              <li>ชื่อที่ขึ้นต้นด้วย @ คือ username ตัวจริง (ไม่ใช่ชื่อที่แสดง และไม่ใช่อีเมล)</li>
              <li>ก๊อปมาแก้ในช่องด้านล่าง แล้วกดบันทึก</li>
            </ol>
            <p className="mt-2 text-muted">
              กดบันทึกแล้วระบบจะลองเพิ่มสิทธิ์ให้ใหม่ทันที ไม่ต้องรอแอดมิน
            </p>
          </div>
        </div>
      )}

      {failed && !nameNotFound && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="font-semibold text-amber-200">ยังเพิ่มสิทธิ์ให้ไม่สำเร็จ</div>
          <p className="mt-1.5 text-sm text-muted">
            ทีมงานเห็นปัญหานี้แล้วและกำลังตามให้ ไม่ต้องทำอะไรเพิ่ม
            {gaveUp ? " ถ้าเกิน 24 ชั่วโมงแล้วยังไม่คืบ แจ้งเราได้ที่หน้าช่วยเหลือ" : ""}
          </p>
        </div>
      )}

      <TradingViewForm current={user?.tradingViewUsername ?? ""} />

      {grant && (
        <div className="card-surface rounded-xl p-5">
          <div className="text-sm text-muted">สถานะสิทธิ์ล่าสุด</div>
          <div className="mt-1 font-semibold">{statusText[grant.status] ?? grant.status}</div>
          {/* ห้ามบอกว่า "รอไม่เกิน 24 ชม." ถ้าการรอไม่ช่วยอะไร — ข้างบนบอกวิธีแก้ไปแล้ว */}
          {grant.status === "PENDING" && !failed && (
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
