import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { promptpayQrDataUrl, promptpayName, promptpayEnabled } from "@/lib/promptpay";
import { SlipUploadForm } from "@/components/account/SlipUploadForm";
import { CheckCircle2, Clock } from "lucide-react";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const order = await prisma.slipOrder.findUnique({ where: { id } });
  if (!order || order.userId !== session!.user.id) {
    return <div className="card-surface rounded-2xl p-6 text-sm text-muted">ไม่พบออเดอร์นี้</div>;
  }
  const plan = plans.find((p) => p.id === order.planCode);
  const qr = order.status === "PENDING" ? await promptpayQrDataUrl(order.amountTHB) : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-2xl font-bold">ชำระเงินผ่าน PromptPay</h1>

      <div className="card-surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <span className="text-muted">แพ็กเกจ {plan?.name ?? order.planCode}</span>
          <span className="font-display text-2xl font-bold">{formatTHB(order.amountTHB)}</span>
        </div>

        {order.status === "APPROVED" ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-up/30 bg-up/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-up" />
            <div>ยืนยันการชำระเงินแล้ว! เปิดสิทธิ์ใช้งานให้เรียบร้อย — ไปที่ <a href="/account" className="text-brand underline">หน้าบัญชี</a></div>
          </div>
        ) : order.status === "SUBMITTED" ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>ได้รับสลิปแล้ว กำลังรอทีมงานตรวจสอบ (ปกติไม่เกิน 24 ชม.) — สถานะจะอัปเดตในหน้าบัญชี</div>
          </div>
        ) : order.status === "REJECTED" ? (
          <div className="mt-5 rounded-xl border border-down/30 bg-down/10 p-4 text-sm text-down">
            สลิปไม่ผ่านการตรวจสอบ กรุณาติดต่อทีมงานผ่านหน้าช่วยเหลือ
          </div>
        ) : !promptpayEnabled ? (
          <div className="mt-5 rounded-xl border border-down/30 bg-down/10 p-4 text-sm text-down">
            ยังไม่ได้ตั้งค่า PromptPay (ตั้ง PROMPTPAY_ID ใน env)
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-col items-center">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="PromptPay QR" className="h-64 w-64 rounded-xl bg-white p-2" />
              )}
              <p className="mt-3 text-sm text-muted">
                สแกนด้วยแอปธนาคาร แล้วโอน <b className="text-foreground">{formatTHB(order.amountTHB)}</b>
                {promptpayName && <> เข้าบัญชี <b className="text-foreground">{promptpayName}</b></>}
              </p>
            </div>
            <div className="mt-6 border-t border-border pt-6">
              <h2 className="font-semibold">แนบสลิปการโอน</h2>
              <p className="mt-1 text-sm text-muted">โอนแล้วแนบรูปสลิปเพื่อยืนยัน ทีมงานจะตรวจและเปิดสิทธิ์ให้</p>
              <div className="mt-4">
                <SlipUploadForm orderId={order.id} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
