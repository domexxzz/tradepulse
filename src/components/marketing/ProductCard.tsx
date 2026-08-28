import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { productCard } from "@/config/features";
import { guideSuites } from "@/config/guide";
import { plansFor } from "@/config/plans";
import { cn, formatTHB } from "@/lib/utils";

/**
 * การ์ดสรุปสินค้า — คำอธิบาย + ภาพกราฟ + ราคา จบในใบเดียว
 *
 * ใช้สองที่:
 *   หน้าแรก — คั่นก่อนตารางราคา ตอบคำถาม "ตกลงซื้ออะไร ราคาเท่าไร" ในหน้าจอเดียว
 *   /card   — การ์ดเดี่ยวกลางจอ ไว้แคปเป็นภาพโฆษณา (ส่ง showCta={false})
 *
 * การจัดวางตั้งใจให้ไม่สมมาตร: หัวเรื่องชิดซ้าย แต่ป้ายราคาอยู่กึ่งกลาง
 * สายตาจึงไล่ลงจากซ้ายบน -> ภาพกราฟ -> จบที่ตัวเลขราคาตรงกลาง
 * ถ้าจัดกึ่งกลางทั้งใบจะกลายเป็นกองข้อความที่ไม่มีลำดับ
 *
 * ⚠️ ราคาต้องรับ monthlyTHB เข้ามาเสมอ ห้ามอ่าน plans ตรง ๆ
 * ด้วยเหตุผลเดียวกับ Hero — plans คือแคตตาล็อก "ราคาเต็ม"
 * ซึ่งไม่ใช่ราคาที่ลูกค้าจ่ายจริงตอนโปร Founding ยังเปิดอยู่
 */
export function ProductCard({
  monthlyTHB,
  suiteId = "gold",
  showCta = true,
  eagerChart = false,
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
   * หน้าแรกไม่ต้องเปิด เพราะการ์ดอยู่ลึกมาก โหลดทันทีคือเสียแบนด์วิดท์เปล่า
   */
  eagerChart?: boolean;
  className?: string;
}) {
  const plans = plansFor(monthlyTHB);
  const entry = plans.find((p) => p.months === 1) ?? plans[0];
  const longest = plans.reduce((a, b) => (b.months > a.months ? b : a), plans[0]);
  const suite = guideSuites.find((s) => s.id === suiteId) ?? guideSuites[0];

  /** โปรยังเปิดอยู่หรือไม่ — ดูจากส่วนต่างจริง ไม่ได้ตั้งค่าธงแยก */
  const discounted = entry.priceTHB < entry.listPriceTHB;

  return (
    <div className={cn("promo-card-glow relative isolate mx-auto max-w-3xl", className)}>
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
            />
            <p className="text-sm font-semibold tracking-wide text-brand">
              {productCard.brandLine}
            </p>
          </div>

          <h2 className="display mt-4 text-[length:var(--display-md)]">
            {productCard.headlineLines.map((line, i) => (
              <span key={line} className="block">
                {i === productCard.headlineLines.length - 1 ? (
                  <span className="text-gradient-brand">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </h2>

          <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">
            {productCard.subtitle}
          </p>

          <ul className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-faint">
            {productCard.highlights.map((h, i) => (
              <li key={h} className="flex items-center gap-2.5">
                {i > 0 && <span aria-hidden>•</span>}
                {h}
              </li>
            ))}
          </ul>
        </header>

        {/* ภาพกราฟจริงที่รันอินดิเคเตอร์ — กรอบบางซ้อนสองชั้นให้ดูเป็นหน้าจอ ไม่ใช่ภาพแปะ */}
        <figure className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface p-1 shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]">
            <Image
              src={suite.chart.src}
              alt={suite.chart.alt}
              width={suite.chart.width}
              height={suite.chart.height}
              className="h-auto w-full rounded-xl"
              sizes="(max-width: 768px) 92vw, 700px"
              priority={eagerChart}
            />
          </div>
          {/* กำกับที่มาไว้บนการ์ดเอง เพราะการ์ดใบนี้ถูกแคปไปโพสต์ต่อโดยไม่มีบริบทรอบข้าง */}
          <figcaption className="mt-2.5 text-[11px] leading-relaxed text-faint">
            ภาพจากกราฟจริงที่รันอินดิเคเตอร์ บันทึกในโหมด Bar Replay ของ TradingView —
            เป็นการสาธิต ไม่ใช่การเทรดสด และไม่ใช่การรับประกันผลในอนาคต
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
          <div className="mt-7 flex justify-center">
            <Button href="#pricing" size="lg">
              ดูแพ็กเกจทั้งหมด
            </Button>
          </div>
        )}
      </article>
    </div>
  );
}
