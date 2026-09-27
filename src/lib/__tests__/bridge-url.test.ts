import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { normalizeBridgeUrl } = await import("@/lib/tradingview");

/**
 * URL ที่บอทรายงานเข้ามา — ใครถือ TV_BOT_SECRET ก็รายงานได้
 * จึงต้องจำกัดให้เป็น tunnel ที่เราใช้จริง ไม่งั้นชี้เว็บไปยิงที่อื่นได้
 */
describe("normalizeBridgeUrl", () => {
  it("รับ Cloudflare quick tunnel และตัด path ทิ้ง", () => {
    expect(normalizeBridgeUrl("https://perform-sensors-complexity-copied.trycloudflare.com/health")).toBe(
      "https://perform-sensors-complexity-copied.trycloudflare.com"
    );
  });

  it("รับ Tailscale Funnel", () => {
    expect(normalizeBridgeUrl("https://asus.tail17bed7.ts.net")).toBe("https://asus.tail17bed7.ts.net");
  });

  it("ไม่รับ http, โดเมนอื่น, IP, พอร์ต หรือ user:pass", () => {
    for (const bad of [
      "http://abc.trycloudflare.com",
      "https://evil.com",
      "https://trycloudflare.com.evil.com",
      "https://evil.com/?x=.trycloudflare.com",
      "https://127.0.0.1",
      "https://abc.trycloudflare.com:8443",
      "https://u:p@abc.trycloudflare.com",
      "https://a.b.trycloudflare.com",
      "ไม่ใช่ url",
    ]) {
      expect(normalizeBridgeUrl(bad), bad).toBeNull();
    }
  });
});
