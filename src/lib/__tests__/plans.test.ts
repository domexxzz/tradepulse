import { describe, it, expect } from "vitest";
import { plansFor, MONTHLY_PROMO, MONTHLY_REGULAR, PROMO_SEATS } from "@/config/plans";

const byId = (list: ReturnType<typeof plansFor>, id: string) => list.find((p) => p.id === id)!;

describe("ราคา Founding 300", () => {
  const p = plansFor(MONTHLY_PROMO);

  it("ราคาที่จ่ายจริงตรงตามตาราง", () => {
    expect(byId(p, "MONTH").priceTHB).toBe(999);
    expect(byId(p, "Q3").priceTHB).toBe(2890);
    expect(byId(p, "H6").priceTHB).toBe(5590);
    expect(byId(p, "YEAR").priceTHB).toBe(10790);
  });

  // เลขพวกนี้ได้จาก Math.round(priceTHB / months) ไม่ได้ตั้งตรง ๆ
  // ขยับ priceTHB นิดเดียวแล้วเลขที่ลูกค้าเห็นเปลี่ยนได้โดยไม่มีอะไรจับ
  it("เฉลี่ยต่อเดือนตรงตามตาราง", () => {
    expect(byId(p, "MONTH").perMonthTHB).toBe(999);
    expect(byId(p, "Q3").perMonthTHB).toBe(963);
    expect(byId(p, "H6").perMonthTHB).toBe(932);
    expect(byId(p, "YEAR").perMonthTHB).toBe(899);
  });

  it("ราคาเต็มคือราคาปกติคูณจำนวนเดือน", () => {
    expect(byId(p, "MONTH").listPriceTHB).toBe(1290);
    expect(byId(p, "Q3").listPriceTHB).toBe(3870);
    expect(byId(p, "H6").listPriceTHB).toBe(7740);
    expect(byId(p, "YEAR").listPriceTHB).toBe(15480);
  });

  it("ส่วนลดคือส่วนต่างจากราคาเต็มจริง ๆ", () => {
    expect(byId(p, "MONTH").savingsTHB).toBe(291);
    expect(byId(p, "Q3").savingsTHB).toBe(980);
    expect(byId(p, "H6").savingsTHB).toBe(2150);
    expect(byId(p, "YEAR").savingsTHB).toBe(4690);
  });

  it("ยิ่งจ่ายยาว เฉลี่ยต่อเดือนยิ่งถูกลง", () => {
    const perMonth = ["MONTH", "Q3", "H6", "YEAR"].map((id) => byId(p, id).perMonthTHB);
    expect(perMonth).toEqual([...perMonth].sort((a, b) => b - a));
  });
});

describe("ราคาหลังที่นั่ง Founding เต็ม", () => {
  const p = plansFor(MONTHLY_REGULAR);

  it("จ่ายเท่าราคาเต็ม ไม่มีส่วนลดเหลือ", () => {
    for (const id of ["MONTH", "Q3", "H6", "YEAR"]) {
      expect(byId(p, id).priceTHB).toBe(byId(p, id).listPriceTHB);
      expect(byId(p, id).savingsTHB).toBe(0);
    }
  });

  // ตั้งใจให้เป็นแบบนี้ตามตารางราคา — จ่ายยาวขึ้นไม่ได้ถูกลง
  // เขียนเทสต์ล็อกไว้เพื่อให้รู้ตัวถ้าวันหลังมีคนตั้งใจเปลี่ยน
  it("ทุกแพ็กเกจเฉลี่ยเท่าราคาปกติรายเดือน", () => {
    for (const id of ["MONTH", "Q3", "H6", "YEAR"]) {
      expect(byId(p, id).perMonthTHB).toBe(MONTHLY_REGULAR);
    }
  });
});

describe("ค่าคงที่ของโปร", () => {
  it("ที่นั่ง 300 และราคาโปรถูกกว่าราคาปกติ", () => {
    expect(PROMO_SEATS).toBe(300);
    expect(MONTHLY_PROMO).toBeLessThan(MONTHLY_REGULAR);
  });
});
