import { describe, it, expect } from "vitest";
import { homeJsonLd } from "@/lib/seo";
import { plansFor, MONTHLY_PROMO, MONTHLY_REGULAR } from "@/config/plans";

/**
 * JSON-LD ประกาศราคาให้ Google อ่าน ถ้าไม่ตรงกับราคาที่คนเห็นบนหน้าเว็บ
 * Google ถือว่าเป็นข้อมูลหลอกและตัด rich result ทิ้ง
 * ช่วงโปรหน้าเว็บแสดง ฿990 แต่ JSON-LD เคยประกาศ ฿1,290 ค้างไว้ — เทสต์นี้กันไม่ให้หลุดอีก
 */
interface Offer {
  name: string;
  price: number;
}
interface AggregateOffer {
  lowPrice: number;
  highPrice: number;
  offerCount: number;
  offers: Offer[];
}

/** ก้อน Product ใน JSON-LD ของหน้าแรก — ตัวที่ประกาศราคาให้ Google อ่าน */
function productOffers(monthly: number): AggregateOffer {
  const product = homeJsonLd(monthly).find((o) => o["@type"] === "Product");
  expect(product, "หา Product ใน JSON-LD ไม่เจอ").toBeDefined();
  return product!.offers as AggregateOffer;
}

describe("ราคาใน JSON-LD ต้องตรงกับราคาที่หน้าเว็บแสดง", () => {
  for (const [label, monthly] of [
    ["ช่วงโปร", MONTHLY_PROMO],
    ["หลังโปรเต็ม", MONTHLY_REGULAR],
  ] as const) {
    it(`${label} — ราคาต่ำสุดและราคารายเดือนตรงกัน`, () => {
      const shown = plansFor(monthly);
      const offers = productOffers(monthly);

      expect(offers.lowPrice).toBe(Math.min(...shown.map((p) => p.priceTHB)));
      expect(offers.highPrice).toBe(Math.max(...shown.map((p) => p.priceTHB)));
      expect(offers.offerCount).toBe(shown.length);

      const monthOffer = offers.offers.find((o) => o.name === "รายเดือน");
      expect(monthOffer?.price).toBe(monthly);
    });
  }

  it("ช่วงโปรกับหลังโปรประกาศราคาไม่เท่ากันจริง ๆ", () => {
    expect(productOffers(MONTHLY_PROMO).lowPrice).toBe(MONTHLY_PROMO);
    expect(productOffers(MONTHLY_REGULAR).lowPrice).toBe(MONTHLY_REGULAR);
  });
});
