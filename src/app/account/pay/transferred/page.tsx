import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { plansForUser } from "@/lib/pricing";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate } from "@/lib/date";
import { startSlipForTransfer } from "@/lib/actions/payment";
import { site, hasLineContact } from "@/config/site";
import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * "โอนเงินมาแล้ว แต่ยังไม่ได้แนบสลิป" — ทางเดียวที่คนกลุ่มนี้มี ตอนหยุดรับชำระเงิน
 *
 * ตอนหยุดรับเงิน ปุ่มสมัครในหน้าราคาถูกปิด และ createQrOrder เด้งกลับหน้าราคาเสมอ
 * คนที่โอนเงินมาก่อนหน้านั้นจึงไม่มีออเดอร์ และไม่มีหน้าให้แนบสลิป
 * เงินเข้าบัญชีเราแล้วแต่ระบบมองไม่เห็นว่าเป็นของใคร แอดมินก็ช่วยอะไรไม่ได้
 *
 * หน้านี้ไม่ได้ขายของ ไม่มี QR ไม่มีการรับเงิน — รับแค่หลักฐานว่าเงินที่เข้ามาแล้ว
 * เป็นของใคร แอดมินยังกดอนุมัติเองทุกใบ
 */
export default async function TransferredPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [plans, existing] = await Promise.all([
    plansForUser(userId),
    prisma.slipOrder.findMany({
      where: { userId, status: { in: ["PENDING", "SUBMITTED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, planCode: true, amountTHB: true, status: true, createdAt: true },
    }),
  ]);

  const submitted = existing.filter((o) => o.status === "SUBMITTED");
  const unfinished = existing.filter((o) => o.status === "PENDING");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">โอนเงินมาแล้ว?</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          ถ้าคุณโอนเงินมาแล้วแต่ยังไม่ได้ส่งสลิปให้เรา เลือกแพ็กเกจที่โอนมา
          แล้วแนบสลิปในหน้าถัดไป ทีมงานจะตรวจสอบและเปิดสิทธิ์ให้
        </p>
      </div>

      {submitted.length > 0 && (
        <div className="card-surface rounded-2xl border border-amber-400/30 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            เราได้รับสลิปของคุณแล้ว
          </p>
          <p className="mt-1.5 text-sm text-muted">
            กำลังรอทีมงานตรวจสอบ (ปกติไม่เกิน 24 ชม.) ไม่ต้องส่งซ้ำ
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {submitted.map((o) => (
              <li key={o.id} className="text-muted">
                {formatTHB(o.amountTHB)} · ส่งเมื่อ {formatThaiDate(o.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ใบที่สร้างไว้แล้วแต่ยังไม่ได้แนบสลิป — พากลับไปทำต่อ อย่าให้สร้างใบซ้ำ */}
      {unfinished.length > 0 && (
        <div className="card-surface rounded-2xl p-5">
          <p className="text-sm font-semibold">คุณเริ่มไว้แล้ว ทำต่อได้เลย</p>
          <ul className="mt-3 space-y-2">
            {unfinished.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/pay/${o.id}`}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm hover:border-brand/40"
                >
                  <span>{formatTHB(o.amountTHB)}</span>
                  <span className="flex items-center gap-1.5 text-brand">
                    แนบสลิป <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-surface rounded-2xl p-6">
        <h2 className="font-semibold">เลือกแพ็กเกจที่คุณโอนมา</h2>
        <p className="mt-1 text-sm text-muted">ยอดต้องตรงกับที่โอนจริง เพื่อให้ตรวจสอบได้เร็ว</p>

        <div className="mt-4 space-y-2.5">
          {plans.map((p) => (
            <form key={p.id} action={startSlipForTransfer}>
              <input type="hidden" name="planCode" value={p.id} />
              <button className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3.5 text-left text-sm transition-colors hover:border-brand/50 hover:bg-surface-2">
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">{p.billingNote}</span>
                </span>
                <span className="tnum shrink-0 font-semibold">{formatTHB(p.priceTHB)}</span>
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="card-surface rounded-2xl p-5 text-sm leading-relaxed text-muted">
        <p className="font-medium text-foreground">โอนมาแล้วแต่ยอดไม่ตรงกับแพ็กเกจไหนเลย?</p>
        <p className="mt-1.5">
          เลือกแพ็กเกจที่ใกล้เคียงที่สุดแล้วแนบสลิปไว้ก่อน ทีมงานเห็นยอดจริงในสลิปและจะติดต่อกลับ
          — เงินของคุณไม่หายไปไหน
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasLineContact && (
            <a
              href={site.contact.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full bg-[#06C755] px-4 text-xs font-semibold text-white hover:opacity-90"
            >
              ติดต่อผ่าน LINE
            </a>
          )}
          <Link
            href="/account/support"
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-xs hover:bg-surface-2"
          >
            หน้าช่วยเหลือ
          </Link>
        </div>
      </div>
    </div>
  );
}
