import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 5xx จากบริดจ์ = ไปไม่ถึงบอท ไม่ใช่บอทปฏิเสธงานของลูกค้ารายนั้น
 *
 * cloudflared ตอบ 530 เมื่อ tunnel ยังอยู่แต่ต้นทางติดต่อไม่ได้ ถ้านับเป็น
 * ความล้มเหลวของคิว ลูกค้าจะกินโควตาจนครบแล้วถูกพักไปทั้งวัน
 * ทั้งที่ไม่มีอะไรผิดที่ตัวเขาเลย และต้นเหตุหายไปแล้ว
 * (เจอจริง 20 พ.ย. 69 — notkab2_3 กับ lamun7260 ติด "บอทตอบกลับ 530" แล้วพักยาว 22 ชม.)
 */

const fetchMock = vi.fn();

vi.mock("@/lib/bridge-url", () => ({
  bridgeUrls: async () => ({ primary: "https://primary.test", backup: "https://backup.test" }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.TV_BOT_SECRET = "s";
  process.env.TV_BOT_URL = "https://primary.test";
  process.env.TV_BOT_URL_BACKUP = "https://backup.test";
});

const urlOf = (n: number) => String(fetchMock.mock.calls[n]?.[0]);

describe("บริดจ์ตอบ 5xx", () => {
  it("ตัวหลักตอบ 530 = ข้ามไปตัวสำรอง", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 530, json: async () => null })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, queued: true }) });

    const { grantTradingViewAccess } = await import("@/lib/tradingview");
    const res = await grantTradingViewAccess("someone", 30);

    expect(res.ok).toBe(true);
    expect(urlOf(0)).toContain("primary.test");
    expect(urlOf(1)).toContain("backup.test");
  });

  it("5xx ทั้งสองตัว = unreachable ไม่ใช่ความผิดของลูกค้า (ไม่นับโควตา)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 530, json: async () => null });

    const { grantTradingViewAccess } = await import("@/lib/tradingview");
    const res = await grantTradingViewAccess("someone", 30);

    expect(res.ok).toBe(false);
    expect(res.unreachable).toBe(true);
  });

  it("4xx = บอทปฏิเสธงานจริง ต้องนับเป็นความล้มเหลว และไม่ลองตัวสำรอง", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "ไม่พบ username" }),
    });

    const { grantTradingViewAccess } = await import("@/lib/tradingview");
    const res = await grantTradingViewAccess("ghost", 30);

    expect(res.ok).toBe(false);
    expect(res.unreachable).toBeUndefined();
    expect(res.reason).toContain("ไม่พบ username");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
