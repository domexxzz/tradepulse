import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { oauthKeys, enabledOAuthProviders } from "@/lib/oauth-env";

/**
 * บั๊กจริงที่เคยเกิด: env บน production ชื่อ GOOGLE_CLIENT_ID แต่โค้ดมองหา
 * AUTH_GOOGLE_ID ปุ่มล็อกอินจึงหายไปทั้งคู่โดยไม่มีใครรู้เป็นเวลานาน
 * เทสต์ชุดนี้คุมไว้ว่าอ่านได้ทั้งสองชื่อ และ "ครึ่ง ๆ กลาง ๆ ต้องไม่เปิด"
 */

const KEYS = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_LINE_ID",
  "AUTH_LINE_SECRET",
  "LINE_CLIENT_ID",
  "LINE_CLIENT_SECRET",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("อ่านคีย์ OAuth", () => {
  it("ชื่อแบบ AUTH_* (ที่ NextAuth อ่านเอง)", () => {
    process.env.AUTH_GOOGLE_ID = "id-a";
    process.env.AUTH_GOOGLE_SECRET = "secret-a";
    expect(oauthKeys("GOOGLE")).toEqual({ clientId: "id-a", clientSecret: "secret-a" });
  });

  it("ชื่อแบบ *_CLIENT_* (ที่ตั้งไว้จริงบน production)", () => {
    process.env.GOOGLE_CLIENT_ID = "id-b";
    process.env.GOOGLE_CLIENT_SECRET = "secret-b";
    expect(oauthKeys("GOOGLE")).toEqual({ clientId: "id-b", clientSecret: "secret-b" });
  });

  it("มีทั้งสองชื่อ = AUTH_* ชนะ (ชื่อที่เป็นมาตรฐานของ NextAuth)", () => {
    process.env.AUTH_LINE_ID = "id-a";
    process.env.AUTH_LINE_SECRET = "secret-a";
    process.env.LINE_CLIENT_ID = "id-b";
    process.env.LINE_CLIENT_SECRET = "secret-b";
    expect(oauthKeys("LINE")).toEqual({ clientId: "id-a", clientSecret: "secret-a" });
  });

  it("ผสมชื่อกันคนละแบบก็ยังอ่านออก", () => {
    process.env.AUTH_LINE_ID = "id-a";
    process.env.LINE_CLIENT_SECRET = "secret-b";
    expect(oauthKeys("LINE")).toEqual({ clientId: "id-a", clientSecret: "secret-b" });
  });

  it("ไม่มีเลย = null", () => {
    expect(oauthKeys("GOOGLE")).toBeNull();
  });

  it("มีแต่ id ไม่มี secret = null (ปุ่มที่กดแล้วพัง แย่กว่าไม่มีปุ่ม)", () => {
    process.env.GOOGLE_CLIENT_ID = "id-b";
    expect(oauthKeys("GOOGLE")).toBeNull();
  });

  it("มีแต่ secret ไม่มี id = null", () => {
    process.env.AUTH_GOOGLE_SECRET = "secret-a";
    expect(oauthKeys("GOOGLE")).toBeNull();
  });

  it("ค่าว่างไม่นับว่ามี", () => {
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_SECRET = "";
    expect(oauthKeys("GOOGLE")).toBeNull();
  });

  it("Google กับ LINE แยกกัน ไม่ปนคีย์ข้ามเจ้า", () => {
    process.env.GOOGLE_CLIENT_ID = "g";
    process.env.GOOGLE_CLIENT_SECRET = "gs";
    expect(oauthKeys("LINE")).toBeNull();
  });
});

describe("รายชื่อที่เปิดใช้ได้", () => {
  it("ไม่ตั้งอะไรเลย = ว่าง", () => {
    expect(enabledOAuthProviders()).toEqual([]);
  });

  it("ตั้งครบทั้งคู่ = ได้ทั้งสอง", () => {
    process.env.GOOGLE_CLIENT_ID = "g";
    process.env.GOOGLE_CLIENT_SECRET = "gs";
    process.env.AUTH_LINE_ID = "l";
    process.env.AUTH_LINE_SECRET = "ls";
    expect(enabledOAuthProviders()).toEqual(["Google", "LINE"]);
  });

  it("ตั้งไม่ครบคู่ = ไม่ถูกนับ", () => {
    process.env.GOOGLE_CLIENT_ID = "g";
    process.env.AUTH_LINE_ID = "l";
    process.env.AUTH_LINE_SECRET = "ls";
    expect(enabledOAuthProviders()).toEqual(["LINE"]);
  });
});
