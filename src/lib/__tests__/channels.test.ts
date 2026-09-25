import { describe, it, expect } from "vitest";
import { SALE_CHANNELS, channelLabel, isRevenueChannel } from "@/config/channels";

/**
 * ช่องทาง wisdom = ลูกค้าเปิดพอร์ตกับโบรกแล้วได้สิทธิ์ 30 วัน
 * ไม่ได้จ่ายเงินให้เรา จึงต้องไม่ใช่ช่องทางรายได้
 *
 * ผลต่อเนื่องที่ตั้งใจ: adminActivateMembership บังคับยอดเป็น 0 ให้ช่องทางที่ไม่ใช่รายได้
 * แปลว่าไม่สร้างแถว Payment → ไม่กินที่นั่งโปร 300 คนแรก
 * ถ้าวันไหนมีคนเผลอย้าย wisdom ไปเป็นช่องทางรายได้ เทสต์นี้จะล้มก่อน
 */
describe("ช่องทางขาย", () => {
  it("มี wisdom อยู่ในรายการให้แอดมินเลือก", () => {
    expect(SALE_CHANNELS.map((c) => c.id)).toContain("wisdom");
    expect(channelLabel("wisdom")).toContain("Wisdom");
  });

  it("wisdom กับ comp ไม่นับเป็นรายได้", () => {
    expect(isRevenueChannel("wisdom")).toBe(false);
    expect(isRevenueChannel("comp")).toBe(false);
  });

  it("ช่องทางที่ลูกค้าจ่ายเราตรง ๆ ยังนับเป็นรายได้เหมือนเดิม", () => {
    for (const id of ["web", "line", "facebook", "instagram", "tiktok", "transfer"]) {
      expect(isRevenueChannel(id), id).toBe(true);
    }
  });

  it("ช่องทางที่ไม่รู้จักถือว่าเป็นรายได้ไว้ก่อน จะได้ไม่เผลอทำยอดหาย", () => {
    expect(isRevenueChannel("ช่องทางที่ยังไม่มี")).toBe(true);
  });
});
