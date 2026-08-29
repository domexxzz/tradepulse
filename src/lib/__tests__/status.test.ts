import { describe, expect, it } from "vitest";
import { PAYMENT_STATUS, SUBSCRIPTION_STATUS, USER_ROLE } from "@/config/status";
import { ACTIVE_STATUSES } from "@/lib/subscription";

/**
 * เทสชุดนี้ไม่ได้เทสตรรกะ แต่มัดค่าคงที่ไว้ไม่ให้เพี้ยนโดยไม่ตั้งใจ
 * ถ้าใครแก้ค่าใดค่าหนึ่งแล้วลืมแก้อีกฝั่ง เทสจะฟ้องก่อนขึ้น production
 */
describe("ค่าสถานะที่ผูกกับข้อมูลจริงในฐานข้อมูล", () => {
  /**
   * ตัวที่อันตรายที่สุด — Payment.status เก็บเป็นตัวพิมพ์เล็กในฐานข้อมูล
   * ถ้าใครเผลอแก้เป็น "PAID" countPaidMembers() จะนับไม่เจอทันที
   * แล้วที่นั่งโปร 300 จะรีเซ็ตกลับเต็มจำนวน ราคาที่ลูกค้าเห็นเพี้ยนโดยไม่มี error
   */
  it("Payment.status เป็นตัวพิมพ์เล็กเท่านั้น", () => {
    expect(PAYMENT_STATUS.PAID).toBe("paid");
  });

  it("สถานะแพ็กเกจเป็นตัวพิมพ์ใหญ่ทั้งหมด", () => {
    for (const v of Object.values(SUBSCRIPTION_STATUS)) {
      expect(v).toBe(v.toUpperCase());
    }
  });

  /** ACTIVE_STATUSES ใน subscription.ts ต้องเป็นชุดย่อยของค่าที่ประกาศไว้จริง */
  it("ACTIVE_STATUSES ทุกตัวมีอยู่ใน SUBSCRIPTION_STATUS", () => {
    const declared = Object.values(SUBSCRIPTION_STATUS) as string[];
    for (const s of ACTIVE_STATUSES) expect(declared).toContain(s);
  });

  it("role มีแค่สองค่า", () => {
    expect(Object.values(USER_ROLE)).toEqual(["USER", "ADMIN"]);
  });
});
