import { SectionHeading } from "@/components/ui/SectionHeading";
import { plansFor, planIncludes } from "@/config/plans";
import { getPromoState } from "@/lib/pricing";
import { PromoSeats } from "./PromoSeats";
import { paymentsEnabled, paymentMode } from "@/config/site";
import { createQrOrder } from "@/lib/actions/payment";
import { formatTHB } from "@/lib/utils";
import { CheckoutButton } from "./CheckoutButton";
import { GuaranteeStrip, GuaranteeLine } from "./GuaranteeBadge";
import { Check } from "lucide-react";

export async function Pricing() {
  const promo = await getPromoState();
  const plans = plansFor(promo.monthlyTHB);

  return (
    <section id="pricing" className="section">
      <div className="container-x">
        <SectionHeading
          align="center"
          eyebrow="ราคา"
          title="เลือกแพ็กเกจที่เหมาะกับคุณ"
          subtitle="ทุกแพ็กเกจได้ฟีเจอร์ครบเหมือนกัน ต่างกันที่ระยะเวลาและราคาเฉลี่ยต่อเดือน"
        />

        <PromoSeats promo={promo} />

        <GuaranteeStrip />

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {plans.map((p) => {
            const primaryBtn =
              "inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong";
            const outlineBtn =
              "inline-flex h-11 w-full items-center justify-center rounded-full border border-border-strong text-sm font-medium text-foreground transition-colors hover:border-brand/50 hover:text-brand hover:bg-brand-wash";
            const cls = p.highlight ? primaryBtn : outlineBtn;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  p.highlight
                    ? "border-brand/45 bg-surface-2 shadow-[0_24px_70px_-40px_rgba(110,227,74,.45)] lg:-my-3 lg:py-9"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-ink">
                    {p.badge}
                  </span>
                )}
                <h3 className="text-sm font-medium text-muted">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="display tnum text-[length:var(--display-sm)]">
                    {formatTHB(p.perMonthTHB)}
                  </span>
                  <span className="text-sm text-muted">/เดือน</span>
                </div>
                <p className="mt-2 text-sm text-muted tnum">
                  จ่าย {formatTHB(p.priceTHB)} · {p.billingNote}
                </p>
                {p.savingsTHB > 0 ? (
                  <p className="pill-brand tnum mt-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium">
                    ประหยัด {formatTHB(p.savingsTHB)}
                  </p>
                ) : (
                  <span className="mt-3 h-[22px]" aria-hidden />
                )}

                <div className="mt-6">
                  {paymentMode === "qr" ? (
                    <form action={createQrOrder}>
                      <input type="hidden" name="planCode" value={p.id} />
                      <button className={cls}>สมัคร · โอนผ่าน QR</button>
                    </form>
                  ) : paymentsEnabled ? (
                    <CheckoutButton planCode={p.id} className={cls}>สมัครสมาชิก</CheckoutButton>
                  ) : (
                    <a href="/register" className={cls}>สมัครบัญชี</a>
                  )}
                  <GuaranteeLine className="mt-3" />
                </div>
              </div>
            );
          })}
        </div>

        {!paymentsEnabled && (
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted">
            สมัครบัญชีไว้ก่อนได้เลย — ระบบชำระเงินออนไลน์กำลังเปิดให้บริการ
          </p>
        )}

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border card-surface p-6">
          <h4 className="text-center font-semibold">ทุกแพ็กเกจได้รับ</h4>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {planIncludes.map((x) => (
              <li key={x} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-1.5 border-t border-border pt-5 text-xs text-muted">
            <li>
              •{" "}
              {paymentMode === "qr"
                ? "ไม่ต่ออายุอัตโนมัติ ไม่มีการตัดเงินโดยไม่แจ้ง"
                : "ยกเลิกได้เองในหน้าบัญชี"}
            </li>
            <li>• การสมัครสมาชิกไม่รับประกันผลกำไร</li>
            <li>• ตรวจสอบ <a href="/refund" className="text-brand hover:underline">รายละเอียดการคืนเงิน</a> ก่อนชำระเงิน</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
