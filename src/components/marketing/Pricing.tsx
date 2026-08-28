import { SectionHeading } from "@/components/ui/SectionHeading";
import { plansFor, planIncludes } from "@/config/plans";
import { getPromoState } from "@/lib/pricing";
import { PromoCard } from "./PromoCard";
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

        <PromoCard promo={promo} variant="pricing" className="mt-10" />

        <GuaranteeStrip />

        <h3 className="mt-12 text-center text-sm font-semibold tracking-wide text-muted">
          เลือกแพ็กเกจ
        </h3>

        {/*
          โชว์ "ราคาเต็มของแพ็กเกจ" เป็นตัวใหญ่ ไม่ใช่ค่าเฉลี่ยต่อเดือน
          เพราะเลขที่ต้องโอนจริงคือยอดเต็ม ค่าเฉลี่ยเอาไว้เทียบกันเฉย ๆ จึงลงมาเป็นบรรทัดรอง

          ป้าย "ประหยัด X%" คิดจาก savingsTHB / listPriceTHB ซึ่งเทียบกับราคาปกติ
          ฿1,290/เดือน ไม่ใช่เทียบกับราคาโปรรายเดือน — ได้ 23 / 25 / 28 / 30%
          และพอโปรหมด savingsTHB จะเป็น 0 เอง ป้ายก็หายไปเองโดยไม่ต้องแก้โค้ด
        */}
        <div className="mt-5 grid gap-5 lg:grid-cols-4">
          {plans.map((p) => {
            const primaryBtn =
              "inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong";
            const outlineBtn =
              "inline-flex h-11 w-full items-center justify-center rounded-full border border-border-card text-sm font-medium text-foreground transition-colors hover:border-brand/50 hover:text-brand hover:bg-brand-wash";
            const cls = p.highlight ? primaryBtn : outlineBtn;
            const savedPct = p.savingsTHB > 0 ? Math.round((p.savingsTHB / p.listPriceTHB) * 100) : 0;

            return (
              <div
                key={p.id}
                className={`card-frame relative flex flex-col rounded-2xl p-6 ${
                  p.highlight ? "plan-card-featured lg:-my-3 lg:py-9" : ""
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-ink">
                    {p.badge}
                  </span>
                )}

                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-muted">{p.name}</h4>
                  {savedPct > 0 && (
                    <span className="pill-brand tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      ประหยัด {savedPct}%
                    </span>
                  )}
                </div>

                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="display tnum text-[length:var(--display-sm)]">
                    {formatTHB(p.priceTHB)}
                  </span>
                  <span className="text-sm text-muted">/ {p.months} เดือน</span>
                </p>

                {p.savingsTHB > 0 ? (
                  <p className="tnum mt-1 text-sm text-faint line-through">
                    {formatTHB(p.listPriceTHB)}
                  </p>
                ) : (
                  <span className="mt-1 h-5" aria-hidden />
                )}

                <p className="tnum mt-2.5 text-[13px] text-muted">
                  เฉลี่ย {formatTHB(p.perMonthTHB)}/เดือน · {p.billingNote}
                </p>

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

        <div className="card-frame mx-auto mt-10 max-w-2xl rounded-2xl p-6">
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
