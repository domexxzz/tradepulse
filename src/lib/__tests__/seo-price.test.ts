import { describe, it, expect } from "vitest";
import { homeJsonLd } from "@/lib/seo";
import { plansFor, MONTHLY_PROMO, MONTHLY_REGULAR } from "@/config/plans";

/**
 * JSON-LD ประกาศราคาให้ Google อ่าน ถ้าไม่ตรงกับราคาที่คนเห็นบนหน้าเว็บ
 * Google ถือว่าเป็นข้อมูลหลอกและตัด rich result ทิ้ง
 * ช่วงโปรหน้าเว็บแสดง ฿990 แต่ JSON-LD เคยประกาศ ฿1,290 ค้างไว้ — เทสต์นี้กันไม่ให้หลุดอีก
 */
const productOf = (monthly: number) =>
  homeJsonLd(monthly).find((o) => o["@type"] === "Product") as
    | Record<string, any>
    | undefined;

describe("ราคาใน JSON-LD ต้องตรงกับราคาที่หน้าเว็บแสดง", () => {
  for (const [label, monthly] of [
    ["ช่วงโปร", MONTHLY_PROMO],
    ["หลังโปรเต็ม", MONTHLY_REGULAR],
  ] as const) {
    it(`${label} — ราคาต่ำสุดและราคารายเดือนตรงกัน`, () => {
      const product = productOf(monthly);
      expect(product).toBeDefined();

      const shown = plansFor(monthly);
      const offers = product!.offers;

      expect(offers.lowPrice).toBe(Math.min(...shown.map((p) => p.priceTHB)));
      expect(offers.highPrice).toBe(Math.max(...shown.map((p) => p.priceTHB)));
      expect(offers.offerCount).toBe(shown.length);

      const monthOffer = offers.offers.find((o: any) => o.name === "รายเดือน");
      expect(monthOffer.price).toBe(monthly);
    });
  }

  it("ช่วงโปรกับหลังโปรประกาศราคาไม่เท่ากันจริง ๆ", () => {
    expect(productOf(MONTHLY_PROMO)!.offers.lowPrice).toBe(MONTHLY_PROMO);
    expect(productOf(MONTHLY_REGULAR)!.offers.lowPrice).toBe(MONTHLY_REGULAR);
  });
});
