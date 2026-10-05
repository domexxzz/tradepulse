import { describe, it, expect } from "vitest";
import { tradingViewNotFoundEmail } from "@/lib/email-templates";

/**
 * ชื่อ TradingView ที่ลูกค้ากรอกไม่มีอยู่จริง
 * แอดมินแก้แทนไม่ได้เพราะไม่รู้ชื่อจริงของเขา อีเมลนี้จึงต้องพาไปหน้าแก้ชื่อ
 * และบอกวิธีหาชื่อผู้ใช้ ไม่ใช่แค่แจ้งว่าพัง
 */
describe("tradingViewNotFoundEmail", () => {
  it("บอกชื่อที่ใช้ไม่ได้ และพาไปหน้าแก้", () => {
    const mail = tradingViewNotFoundEmail({ name: "เบส", username: "Kiadthawee" });
    expect(mail.html).toContain("Kiadthawee");
    expect(mail.html).toContain("/account/tradingview");
    expect(mail.text).toContain("/account/tradingview");
  });

  it("บอกวิธีหาชื่อผู้ใช้ที่ถูกต้อง ไม่ใช่แค่บอกว่าผิด", () => {
    const mail = tradingViewNotFoundEmail({ name: null, username: "abc" });
    expect(mail.html).toContain("รูปโปรไฟล์");
  });

  it("ไม่ปล่อย HTML จากชื่อที่ลูกค้ากรอกเข้าไปในอีเมล", () => {
    const mail = tradingViewNotFoundEmail({ name: null, username: "<img src=x onerror=y>" });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img");
  });
});
