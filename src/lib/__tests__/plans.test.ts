import { describe, it, expect } from "vitest";
import { plansFor, MONTHLY_PROMO, MONTHLY_REGULAR, PROMO_SEATS } from "@/config/plans";

const byId = (list: ReturnType<typeof plansFor>, id: string) => list.find((p) => p.id === id)!;

describe("ราคาช่วงโปร (300 คนแรก)", () => {
  const p = plansFor(MONTHLY_PROMO);

  it("รายเดือนเป็นราคาโปร", () => {
    expect(byId(p, "MONTH").priceTHB).toBe(990);
    expect(byId(p, "MONTH").perMonthTHB).toBe(990);
  });

  it("แพ็กเกจยาวราคาไม่เปลี่ยน", () => {
    expect(byId(p, "Q3").priceTHB).toBe(2670);
    expect(byId(p, "H6").priceTHB).toBe(4740);
    expect(byId(p, "YEAR").priceTHB).toBe(7990);
  });

  it("ส่วนลดคิดเทียบราคาโปร", () => {
    expect(byId(p, "Q3").savingsTHB).toBe(300);
    expect(byId(p, "H6").savingsTHB).toBe(1200);
    expect(byId(p, "YEAR").savingsTHB).toBe(3890);
  });
});

describe("ราคาหลังโปรเต็ม", () => {
  const p = plansFor(MONTHLY_REGULAR);

  it("รายเดือนขึ้นเป็น 1290", () => {
    expect(byId(p, "MONTH").priceTHB).toBe(1290);
  });

  it("แพ็กเกจยาวยังราคาเดิม ไม่ขึ้นตาม", () => {
    expect(byId(p, "Q3").priceTHB).toBe(2670);
    expect(byId(p, "H6").priceTHB).toBe(4740);
    expect(byId(p, "YEAR").priceTHB).toBe(7990);
  });

  it("ส่วนลดโตขึ้นตามส่วนต่างจริง ไม่ใช่ตัวเลขที่ตั้งเอง", () => {
    expect(byId(p, "Q3").savingsTHB).toBe(1200);
    expect(byId(p, "H6").savingsTHB).toBe(3000);
    expect(byId(p, "YEAR").savingsTHB).toBe(7490);
  });
});

describe("ค่าคงที่ของโปร", () => {
  it("ที่นั่ง 300 และราคาโปรถูกกว่าราคาปกติ", () => {
    expect(PROMO_SEATS).toBe(300);
    expect(MONTHLY_PROMO).toBeLessThan(MONTHLY_REGULAR);
  });

  it("รายเดือนไม่มีส่วนลด เพราะเป็นฐานเทียบเอง", () => {
    expect(byId(plansFor(MONTHLY_PROMO), "MONTH").savingsTHB).toBe(0);
    expect(byId(plansFor(MONTHLY_REGULAR), "MONTH").savingsTHB).toBe(0);
  });
});
