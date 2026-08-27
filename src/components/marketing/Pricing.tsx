import { SectionHeading } from "@/components/ui/SectionHeading";
import { plansFor, planIncludes } from "@/config/plans";
import { getPromoState } from "@/lib/pricing";
import { PromoSeats } from "./PromoSeats";
import { paymentsEnabled, paymentMode } from "@/config/site";
import { PlanSelector } from "./PlanSelector";
import { GuaranteeStrip } from "./GuaranteeBadge";
import { TrustCenter } from "./TrustCenter";

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

        {/* ⚠️ อย่าเอาบล็อกอธิบายกลับมาไว้เหนือราคาอีก
            วัดของเดิมแล้ว: จากขอบบน section ถึงตัวเลขราคาตัวแรก = 750px
            คือ TrustCenter (6 ข้อ) + PromoSeats + GuaranteeStrip ซ้อนกันอยู่ข้างหน้า
            คนกดเมนู "ราคา" มาเพื่อดูราคา ไม่ใช่มาอ่านเงื่อนไขก่อน
            TrustCenter ย้ายไปไว้ใต้ราคาแล้ว — มันคือข้อมูล "ก่อนจ่ายเงิน"
            ซึ่งจะมีความหมายก็ต่อเมื่อเห็นราคาแล้วเท่านั้น */}
        <PromoSeats promo={promo} />

        <PlanSelector
          plans={plans}
          includes={planIncludes}
          paymentMode={paymentMode}
          paymentsEnabled={paymentsEnabled}
        />

        {!paymentsEnabled && (
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted">
            สมัครบัญชีไว้ก่อนได้เลย — ระบบชำระเงินออนไลน์กำลังเปิดให้บริการ
          </p>
        )}

        {/* รายการ "ได้รับอะไรบ้าง" ย้ายเข้าไปอยู่ในการ์ดของ PlanSelector แล้ว
            ตรงนี้เหลือเฉพาะเงื่อนไขตัวเล็ก ไม่งั้นจะพิมพ์รายการเดียวกันสองรอบในจอเดียว */}
        <ul className="mx-auto mt-8 max-w-2xl space-y-1.5 text-center text-xs text-muted">
          <li>
            {paymentMode === "qr"
              ? "ไม่ต่ออายุอัตโนมัติ ไม่มีการตัดเงินโดยไม่แจ้ง"
              : "ยกเลิกได้เองในหน้าบัญชี"}
          </li>
          <li>การสมัครสมาชิกไม่รับประกันผลกำไร</li>
          <li>
            ตรวจสอบ{" "}
            <a href="/refund" className="text-brand hover:underline">
              รายละเอียดการคืนเงิน
            </a>{" "}
            ก่อนชำระเงิน
          </li>
        </ul>

        <GuaranteeStrip />

        {/* ข้อมูล "ก่อนจ่ายเงิน" — อยู่ใต้ราคาเพราะจะมีความหมายก็ต่อเมื่อเห็นราคาแล้ว */}
        <TrustCenter />
      </div>
    </section>
  );
}
