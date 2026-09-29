import { describe, it, expect, beforeAll } from "vitest";

/**
 * state คือสิ่งเดียวที่กันคนหลอกให้เหยื่อผูกบัญชี Discord ของผู้โจมตีเข้าบัญชีเหยื่อ
 * (callback ไม่ได้เชื่อ cookie เพราะ Discord พากลับมาแบบ cross-site)
 * ถ้าตรวจ state หลวม ใครก็ประกอบ URL callback ให้เหยื่อกดได้
 */
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-state-signing";
  process.env.NEXT_PUBLIC_SITE_URL = "https://quantvisionx.com";
});

const load = async () => import("@/lib/discord-oauth");

describe("discord oauth · state", () => {
  it("เซ็นแล้วอ่านกลับได้ userId เดิม", async () => {
    const { signState, verifyState } = await load();
    expect(verifyState(signState("user_abc"))).toBe("user_abc");
  });

  it("แก้ payload แล้วลายเซ็นต้องไม่ผ่าน", async () => {
    const { signState, verifyState } = await load();
    const [, mac] = signState("user_abc").split(".");
    const forged = `${Buffer.from("user_victim.1700000000000").toString("base64url")}.${mac}`;
    expect(verifyState(forged)).toBeNull();
  });

  it("ไม่มีลายเซ็นต้องไม่ผ่าน", async () => {
    const { verifyState } = await load();
    expect(verifyState(Buffer.from("user_abc.1700000000000").toString("base64url"))).toBeNull();
    expect(verifyState("")).toBeNull();
    expect(verifyState("ขยะ.ขยะ")).toBeNull();
  });

  it("เกิน 10 นาทีต้องหมดอายุ", async () => {
    const { verifyState } = await load();
    const { createHmac } = await import("node:crypto");
    const payload = `user_abc.${Date.now() - 11 * 60 * 1000}`;
    const mac = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(payload).digest("base64url");
    const stale = `${Buffer.from(payload).toString("base64url")}.${mac}`;
    expect(verifyState(stale)).toBeNull();
  });
});

describe("discord oauth · ปลายทางที่ต้องตรงกับที่ลงทะเบียนไว้", () => {
  it("redirect_uri ประกอบจากโดเมนจริง ไม่มี / เกิน", async () => {
    const { redirectUri } = await load();
    expect(redirectUri()).toBe("https://quantvisionx.com/api/discord/callback");
  });

  it("ขอแค่ identify กับ guilds.join — ไม่ขออ่านข้อความหรืออีเมล", async () => {
    const { authorizeUrl } = await load();
    const scope = new URL(authorizeUrl("s")).searchParams.get("scope");
    expect(scope).toBe("identify guilds.join");
    expect(scope).not.toContain("email");
    expect(scope).not.toContain("messages");
  });
});
