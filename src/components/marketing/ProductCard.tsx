import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { LoopingClip } from "@/components/guide/LoopingClip";
import { productCard } from "@/config/features";
import { guideSuites, heroClip } from "@/config/guide";
import { plansFor } from "@/config/plans";
import { tradingView } from "@/config/site";
import { cn, formatTHB } from "@/lib/utils";

/**
 * การ์ดสรุปสินค้า — คำอธิบาย + กราฟ + ราคา จบในใบเดียว
 *
 * ใช้สามที่:
 *   หน้าแรก (asHero) — เป็นหัวหน้าเว็บแทน Hero เดิม ใช้ h1 + คลิป + ปุ่มคู่
 *   /card            — การ์ดเดี่ยวกลางจอ ไว้แคปเป็นภาพโฆษณา (showCta={false})
 *   ที่อื่น           — การ์ดสรุปธรรมดา h2 + ภาพนิ่ง
 *
 * การจัดวางตั้งใจให้ไม่สมมาตร: หัวเรื่องชิดซ้าย แต่ป้ายราคาอยู่กึ่งกลาง
 * สายตาจึงไล่ลงจากซ้ายบน -> กราฟ -> จบที่ตัวเลขราคาตรงกลาง
 * ถ้าจัดกึ่งกลางทั้งใบจะกลายเป็นกองข้อความที่ไม่มีลำดับ
 *
 * ⚠️ ราคาต้องรับ monthlyTHB เข้ามาเสมอ ห้ามอ่าน plans ตรง ๆ
 * plans คือแคตตาล็อก "ราคาเต็ม" ซึ่งในโครง Founding 300 ทุกแพ็กเกจเฉลี่ย 1,290 เท่ากันหมด
 * ถ้าอ่านจากตรงนั้นตอนโปรยังเปิด การ์ดจะโฆษณา 1,290 ทั้งที่หน้าราคาเก็บจริง 999
 */
export function ProductCard({
  monthlyTHB,
  suiteId = "gold",
  showCta = true,
  eagerChart = false,
  asHero = false,
  fluid = false,
  className,
}: {
  /** ราคารายเดือนที่ใช้อยู่จริงตอนนี้ (มาจาก getPromoState) */
  monthlyTHB: number;
  /** ชุดอินดิเคเตอร์ที่หยิบภาพกราฟมาใช้ — ค่าเริ่มต้นคือชุด Gold ที่ป้าย BUY/TP/SL อ่านง่ายที่สุด */
  suiteId?: string;
  /** ปิดปุ่มตอนเอาการ์ดไปแคปเป็นภาพ — ปุ่มในภาพนิ่งกดไม่ได้อยู่แล้ว */
  showCta?: boolean;
  /**
   * โหลดภาพกราฟทันทีแทน lazy
   *
   * การ์ดสูงกว่าจอ 720px ภาพกราฟจึงอยู่ใต้พับเสมอ พอเป็น lazy แล้วเปิดหน้า /card
   * ไปแคปทันทีจะได้ช่องว่างแทนกราฟ — หน้าที่มีไว้แคปต้องโหลดครบตั้งแต่แรก
   * ไม่มีผลตอน asHero เพราะโหมดนั้นใช้คลิป ไม่ใช่ภาพนิ่ง
   */
  eagerChart?: boolean;
  /**
   * ใช้การ์ดใบนี้เป็นหัวของหน้า แทน Hero เดิม
   *
   * ต่างจากโหมดปกติสามอย่าง และทั้งสามอย่างจำเป็น ไม่ใช่แค่ตกแต่ง:
   *   1. พาดหัวเป็น h1 — หนึ่งหน้ามี h1 ได้ใบเดียว ถ้าการ์ดขึ้นมาแทน Hero
   *      แล้วยังเป็น h2 อยู่ หน้าแรกจะไม่มี h1 เลย ซึ่งกระทบ SEO ตรง ๆ
   *   2. ใช้คลิป Bar Replay แทนภาพนิ่ง — คลิปคือหลักฐานที่แรงที่สุดที่มี
   *      (เห็นสัญญาณกับโซนโผล่ทีละแท่ง) ทิ้งไปเพราะเปลี่ยนเลย์เอาท์คือเสียของ
   *   3. ปุ่มคู่พร้อมราคาบนปุ่ม — ตำแหน่งหัวหน้าเว็บต้องมีทางไปต่อที่ชัด
   *      ไม่ใช่ปุ่มเดียวที่พาไปดูตารางราคาเฉย ๆ
   */
  asHero?: boolean;
  /**
   * กว้างเต็มพ่อแม่ ไม่จำกัดความกว้างเอง — ใช้ตอนวางการ์ดในคอลัมน์ของ grid
   *
   * ต้องเป็น prop ไม่ใช่ส่ง max-w-none มาทาง className เพราะ cn() ในโปรเจกต์นี้
   * เป็น clsx เปล่า ๆ ไม่มี tailwind-merge — max-w-4xl กับ max-w-none จะติดมาทั้งคู่
   * แล้วผลลัพธ์ขึ้นกับลำดับใน stylesheet ซึ่งเดาไม่ได้
   */
  fluid?: boolean;
  className?: string;
}) {
  const plans = plansFor(monthlyTHB);
  const entry = plans.find((p) => p.months === 1) ?? plans[0];
  const longest = plans.reduce((a, b) => (b.months > a.months ? b : a), plans[0]);
  const suite = guideSuites.find((s) => s.id === suiteId) ?? guideSuites[0];

  /** โปรยังเปิดอยู่หรือไม่ — ดูจากส่วนต่างจริง ไม่ได้ตั้งค่าธงแยก */
  const discounted = entry.priceTHB < entry.listPriceTHB;

  /** พาดหัวของหน้าต้องเป็น h1 ได้ใบเดียว — ดูเหตุผลเต็มที่ prop asHero */
  const Headline = asHero ? "h1" : "h2";

  return (
    <div
      className={cn(
        "promo-card-glow relative isolate",
        // โหมดหัวหน้าเว็บกว้างขึ้นหนึ่งขั้น ไม่งั้นการ์ดจะดูลอยเล็กอยู่กลางจอกว้าง
        fluid ? "w-full" : asHero ? "mx-auto max-w-4xl" : "mx-auto max-w-3xl",
        className
      )}
    >
      <article className="promo-card relative overflow-hidden rounded-[2rem] border border-border-strong px-6 py-9 shadow-[0_50px_120px_-60px_rgba(0,0,0,1)] sm:px-10 sm:py-12">
        <header>
          <div className="flex items-center gap-2.5">
            {/* โลโก้ตัวเล็กข้างชื่อแบรนด์ — alt ว่างเพราะข้อความข้าง ๆ บอกชื่ออยู่แล้ว */}
            <Image
              src="/images/brand/qvx-logo-hex-v1.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
              priority={asHero}
            />
            <p className="text-sm font-semibold tracking-wide text-brand">
              {productCard.brandLine}
            </p>
          </div>

          {/* ขนาดพาดหัวเท่ากันทั้งสองโหมด ไม่ขยายตอน asHero
              ลองใช้ --display-lg แล้ววัดของจริง: 70px ทำให้ "Complete XAUUSD Analysis"
              ตกเป็นสามบรรทัดในการ์ดกว้าง 896px จุดตัดที่วางไว้ใน headlineLines พังทันที
              และการ์ดสูงจนมองไม่เห็นราคาโดยไม่เลื่อน ซึ่งเสียจุดขายของการ์ด */}
          <Headline className="display mt-4 text-[length:var(--display-md)]">
            {productCard.headlineLines.map((line, i) => (
              <span key={line} className="block">
                {i === productCard.headlineLines.length - 1 ? (
                  <span className="text-gradient-brand">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </Headline>

          <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">
            {productCard.subtitle}
          </p>

          <ul className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-faint">
            {/* จุดคั่นต่อท้ายรายการ ไม่ใช่นำหน้า — บนมือถือแถวนี้ตกบรรทัด
                ถ้าคั่นแบบนำหน้า บรรทัดที่สองจะขึ้นต้นด้วย "•" ลอย ๆ */}
            {productCard.highlights.map((h, i) => (
              <li key={h} className="flex items-center gap-2.5">
                {h}
                {i < productCard.highlights.length - 1 && <span aria-hidden>•</span>}
              </li>
            ))}
          </ul>
        </header>

        {/* กราฟจริงที่รันอินดิเคเตอร์ — กรอบบางซ้อนสองชั้นให้ดูเป็นหน้าจอ ไม่ใช่ภาพแปะ */}
        <figure className="mt-8">
          <div className="card-frame overflow-hidden rounded-2xl p-1">
            {asHero ? (
              <LoopingClip
                src={heroClip.src}
                poster={heroClip.poster}
                label={heroClip.label}
                width={heroClip.width}
                height={heroClip.height}
                eager
              />
            ) : (
              <Image
                src={suite.chart.src}
                alt={suite.chart.alt}
                width={suite.chart.width}
                height={suite.chart.height}
                className="h-auto w-full rounded-xl"
                sizes="(max-width: 768px) 92vw, 700px"
                priority={eagerChart}
              />
            )}
          </div>
          {/* กำกับที่มาไว้บนการ์ดเอง เพราะการ์ดใบนี้ถูกแคปไปโพสต์ต่อโดยไม่มีบริบทรอบข้าง */}
          <figcaption className="mt-2.5 text-[11px] leading-relaxed text-faint">
            {asHero ? "คลิป" : "ภาพ"}จากกราฟจริงที่รันอินดิเคเตอร์ บันทึกในโหมด Bar Replay
            ของ TradingView — เป็นการสาธิต ไม่ใช่การเทรดสด และไม่ใช่การรับประกันผลในอนาคต
          </figcaption>
        </figure>

        {/* ป้ายราคา — จุดจบสายตาของการ์ด */}
        <div className="price-sticker mx-auto mt-9 w-fit max-w-full rounded-3xl px-8 py-5 text-center sm:px-10">
          {discounted && (
            <p className="tnum text-sm text-faint line-through">
              {formatTHB(entry.listPriceTHB)}/เดือน
            </p>
          )}
          <p className="mt-0.5 flex items-baseline justify-center gap-1.5">
            <span className="display tnum text-gradient-brand text-[length:var(--price-xl)]">
              {formatTHB(entry.priceTHB)}
            </span>
            <span className="text-sm font-medium text-muted">/เดือน</span>
          </p>
          <p className="mt-2.5 text-[13px] font-medium text-foreground">
            {discounted
              ? "ราคา Founding 300 — ล็อกราคานี้ไว้ตลอดอายุสมาชิก"
              : "ชำระเป็นรอบ ไม่ตัดบัตรอัตโนมัติ"}
          </p>
          <p className="tnum mt-1 text-[13px] text-muted">
            มีแพ็กเกจ 3 / 6 / 12 เดือน — ยาวสุด {formatTHB(longest.priceTHB)}
          </p>
        </div>

        {showCta && (
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {asHero ? (
              <>
                <Button href="#pricing" size="lg">
                  เริ่มใช้งาน · {formatTHB(entry.priceTHB)}/เดือน
                </Button>
                {/* ชี้ไปกราฟจริงบน TradingView ไม่ใช่ section ในหน้านี้ —
                    ปลายทางตรงกับข้อความบนปุ่มมากกว่า และ TradingView ฝัง iframe ไม่ได้ */}
                <Button
                  href={tradingView.chartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="lg"
                >
                  ดูการทำงานบน TradingView
                </Button>
              </>
            ) : (
              <Button href="#pricing" size="lg">
                ดูแพ็กเกจทั้งหมด
              </Button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
