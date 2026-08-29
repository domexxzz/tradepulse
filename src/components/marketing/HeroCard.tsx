import { ShieldCheck } from "lucide-react";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/ui/Button";
import { LoopingClip } from "@/components/guide/LoopingClip";
import { PromoCard } from "@/components/marketing/PromoCard";
import { productCard, trustItems } from "@/config/features";
import { heroClip } from "@/config/guide";
import { plansFor } from "@/config/plans";
import { tradingView } from "@/config/site";
import { formatTHB } from "@/lib/utils";
import type { PromoState } from "@/lib/pricing";

/**
 * หัวหน้าเว็บ — คอลัมน์เดียว กึ่งกลาง เรียงลงมาตามลำดับที่ลูกค้ากำหนด
 *
 *   1. ส่วนแนะนำ QVX   ไม่มีกรอบ ใช้พื้นหลังเว็บต่อเนื่อง
 *   2. การ์ดโปรโมชั่น   มีกรอบแยกจากพื้นชัดเจน เพราะเป็นข้อมูลสำคัญ
 *   3. ปุ่มดำเนินการ    อยู่นอกกรอบ ต่อจากการ์ดโปร
 *   4. คลิปกราฟ        กรอบบางพอให้เห็นขอบจอ ไม่ใช่การ์ดใหญ่ครอบ
 *
 * ⚠️ ของเดิมเป็นสองคอลัมน์ และห่อส่วนแนะนำไว้ในการ์ดใบใหญ่ (ProductCard asHero)
 * ลูกค้าสั่งเลิกทั้งสองอย่าง — กรอบใบใหญ่ทำให้ "การ์ดซ้อนการ์ด" แล้วการ์ดโปรไม่เด่น
 * ProductCard ยังอยู่ ใช้ที่หน้า /card สำหรับแคปเป็นภาพโฆษณาเท่านั้น
 *
 * สิ่งที่ section นี้ถือไว้และจะหายถ้าเอาออก: id="top" (โลโก้ navbar ลิงก์มา),
 * ระยะเลี่ยง navbar ที่เป็น fixed, เส้นเลเซอร์, แถบ trustItems, บรรทัดคำเตือน
 */
export function HeroCard({ promo }: { promo: PromoState }) {
  const plans = plansFor(promo.monthlyTHB);
  const entry = plans.find((p) => p.months === 1) ?? plans[0];

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
        {/* 1. ส่วนแนะนำ — ไม่มีกรอบ กึ่งกลางทั้งบนคอมและมือถือ */}
        <div className="rise rise-1 mx-auto max-w-2xl text-center">
          <p className="eyebrow">{productCard.brandLine}</p>

          {/* บรรทัดแรกขาว ที่เหลือไล่เฉดเขียว ตามภาพตัวอย่าง */}
          <h1 className="display mt-4 text-[length:var(--display-lg)]">
            {productCard.headlineLines.map((line, i) => (
              <span key={line} className="block">
                {i === 0 ? line : <span className="text-gradient-brand">{line}</span>}
              </span>
            ))}
          </h1>

          <p className="lede mx-auto mt-6">{productCard.subtitle}</p>
        </div>

        {/* 2. การ์ดโปรโมชั่น — ใบเดียวในหน้าที่มีกรอบ จึงดึงสายตาได้เต็มที่ */}
        <PromoCard promo={promo} variant="hero" className="rise rise-2 mt-10" />

        {/* 3. ปุ่มดำเนินการ — นอกกรอบ ต่อจากการ์ดโปร */}
        <div className="rise rise-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="#pricing" size="lg">
            เริ่มใช้งาน · เริ่มต้น {formatTHB(entry.priceTHB)}/เดือน
          </Button>
          {/* ชี้ไปกราฟจริงบน TradingView ไม่ใช่ section ในหน้านี้ —
              ปลายทางตรงกับข้อความบนปุ่ม และ TradingView ฝัง iframe ไม่ได้ */}
          <Button
            href={tradingView.chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="lg"
          >
            ดูการทำงานบน TradingView
          </Button>
        </div>

        {/* 4. คลิปกราฟ — กรอบบางพอให้ดูเป็นหน้าจอ ไม่ใช่การ์ดใหญ่ครอบอีกชั้น */}
        <figure className="rise rise-4 mx-auto mt-12 max-w-4xl">
          <div className="card-frame overflow-hidden rounded-2xl p-1">
            <LoopingClip
              src={heroClip.src}
              poster={heroClip.poster}
              label={heroClip.label}
              width={heroClip.width}
              height={heroClip.height}
              eager
            />
          </div>
          <figcaption className="mt-3 text-center text-xs leading-relaxed text-faint">
            คลิปจากกราฟจริงที่รันอินดิเคเตอร์ บันทึกในโหมด Bar Replay ของ TradingView ·
            เป็นการเดินย้อนหลังเพื่อสาธิต ไม่ใช่การเทรดสด และไม่ใช่การรับประกันผลในอนาคต
          </figcaption>
        </figure>

        {/* จุดเด่นสั้น ๆ ปิดท้าย section */}
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
