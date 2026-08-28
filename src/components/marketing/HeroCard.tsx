import { ShieldCheck } from "lucide-react";
import { Icon } from "@/components/common/Icon";
import { ProductCard } from "@/components/marketing/ProductCard";
import { PromoCard } from "@/components/marketing/PromoCard";
import { trustItems } from "@/config/features";
import type { PromoState } from "@/lib/pricing";

/**
 * หัวหน้าเว็บ — การ์ดสรุปสินค้าใบเดียว แทน Hero เลย์เอาท์เดิม
 *
 * ตัวการ์ดอยู่ใน ProductCard (asHero) ไฟล์นี้ทำหน้าที่เป็น "กรอบ section"
 * ที่ถือของซึ่ง Hero เดิมถืออยู่ และจะหายไปถ้าเอา Hero ออกเฉย ๆ:
 *
 *   id="top"                 โลโก้ใน Navbar ลิงก์มาที่ #top ถ้าไม่มี anchor กดแล้วไม่ไปไหน
 *   pt-[var(--sp-hero)]      navbar เป็น fixed สูง 64px ไม่เผื่อระยะบนไว้ การ์ดจะมุดใต้แถบเมนู
 *   .hero-market-depth       เส้นเลเซอร์ + จุดพัลส์เรดาร์ที่เคยขอให้ย้อนกลับมาใช้
 *   trustItems               แถบจุดเด่นสี่ข้อ
 *   บรรทัดคำเตือน             "เครื่องมือช่วยวิเคราะห์ ไม่ใช่สัญญาณการันตีกำไร"
 *
 * ⚠️ Hero.tsx ยังอยู่ในโปรเจกต์ ไม่ได้ลบทิ้ง เผื่อจะย้อนกลับไปใช้เลย์เอาท์เดิม
 * ย้อนกลับ: เปลี่ยน <HeroCard /> ใน app/page.tsx กลับเป็น <Hero monthlyTHB={...} />
 */
export function HeroCard({ promo }: { promo: PromoState }) {
  // ระยะบนน้อยกว่า Hero เดิม (--sp-hero = 152px บนจอกว้าง)
  // เพราะการ์ดมี padding ในตัวอีก 48px ซ้อนกันแล้วกลายเป็นช่องว่าง 200px
  // ที่อ่านเป็น "หน้าเว็บโหลดไม่ครบ" มากกว่าพื้นที่หายใจ
  // 96/112px ยังเคลียร์ navbar ที่สูง 64px ได้สบาย
  //
  // ⚠️ คอมเมนต์ตรงนี้ต้องเป็น // ห้ามใช้ {/* */} — มันจะกลายเป็นลูกอีกตัว
  // ข้าง <section> ที่ระดับบนสุดของ return แล้ว parser พัง (Expected ',', got 'ident')
  return (
    <section
      id="top"
      className="hero-terminal relative overflow-hidden pb-[var(--sp-md)] pt-24 sm:pt-28"
    >
      {/* เส้นเรืองแสงสามเส้น + จุดพัลส์เรดาร์ — ตกแต่งล้วน ๆ ไม่มีความหมายให้ screen reader
          สไตล์อยู่ที่ .hero-market-depth ใน globals.css และหยุดเองเมื่อผู้ใช้ตั้ง reduced-motion */}
      <div className="hero-market-depth" aria-hidden>
        <span className="hero-market-depth__line hero-market-depth__line--one" />
        <span className="hero-market-depth__line hero-market-depth__line--two" />
        <span className="hero-market-depth__line hero-market-depth__line--three" />
        <span className="hero-market-depth__pulse" />
      </div>

      <div className="container-x">
        {/* สองคอลัมน์บนจอกว้าง — ลูกค้าขอให้ "เปิดมาหน้าแรกเจอเลย"
            ของเดิมบล็อกโปรอยู่ใต้การ์ดซึ่งสูง ~950px ต้องเลื่อนเกือบเต็มจอถึงจะเห็น
            วางคู่กันแล้วทั้งสองอย่างอยู่ในหน้าจอแรกพร้อมกัน
            จอแคบกว่า lg ยังเรียงบนล่าง เพราะบีบสองคอลัมน์แล้วกราฟจะเล็กจนอ่านไม่ออก

            items-start ไม่ใช่ stretch ที่เป็นค่าเริ่มต้น — ไม่งั้นบล็อกโปรถูกยืดสูงเท่าการ์ด
            แล้วเนื้อหาข้างในลอยอยู่กลางกล่องเปล่า */}
        <div className="grid items-start gap-7 lg:grid-cols-12">
          <ProductCard
            monthlyTHB={promo.monthlyTHB}
            asHero
            fluid
            className="rise rise-1 lg:col-span-7"
          />

          {/* บล็อกโปร Founding 300 — ลิงก์ "รายละเอียด" พาไป #pricing ตามที่สั่ง */}
          <PromoCard promo={promo} variant="hero" className="rise rise-2 lg:col-span-5" />
        </div>

        {/* จุดเด่นสั้น ๆ — อยู่นอกการ์ด ไม่ให้แย่งความสนใจจากพาดหัวและราคา */}
        <ul className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {trustItems.map((t) => (
            <li key={t.label} className="flex items-center gap-2 text-sm text-muted">
              <Icon name={t.icon} className="h-4 w-4 text-brand" />
              {t.label}
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-faint">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          เครื่องมือช่วยวิเคราะห์ ไม่ใช่สัญญาณการันตีกำไร — ผู้ใช้ตัดสินใจและบริหารความเสี่ยงเอง
        </p>
      </div>
    </section>
  );
}
