import { describe, it, expect } from "vitest";
import { safeCallbackPath } from "@/lib/safe-redirect";

/** callbackUrl มาจาก query string — ต้องพากลับได้แค่ในเว็บเราเท่านั้น */
const SITE = "https://qvx.example";

describe("safeCallbackPath", () => {
  it("รับ path ในเว็บตามเดิม", () => {
    expect(safeCallbackPath("/activation", SITE)).toBe("/activation");
    expect(safeCallbackPath("/account/wisdom?x=1#apply", SITE)).toBe("/account/wisdom?x=1#apply");
  });

  it("URL เต็มที่ origin ตรงกับเว็บ ตัดเหลือ path (แบบที่ proxy ของ NextAuth แนบมา)", () => {
    expect(safeCallbackPath("https://qvx.example/account/discord", SITE)).toBe("/account/discord");
  });

  it("ไม่พาออกนอกเว็บ", () => {
    for (const bad of [
      "https://evil.example/activation",
      "//evil.example/activation",
      "/\\evil.example",
      "/\t/evil.example",
      "http://qvx.example/activation", // คนละ scheme = คนละ origin
      "javascript:alert(1)",
    ]) {
      expect(safeCallbackPath(bad, SITE), bad).toBeNull();
    }
  });

  it("ค่าว่างหรือไม่ใช่ข้อความ คืน null", () => {
    expect(safeCallbackPath("", SITE)).toBeNull();
    expect(safeCallbackPath(null, SITE)).toBeNull();
    expect(safeCallbackPath(undefined, SITE)).toBeNull();
  });
});
