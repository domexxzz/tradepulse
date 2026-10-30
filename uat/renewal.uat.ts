import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * UAT ของเส้นทางต่ออายุ — ชนฐานข้อมูลจริง และดักที่ "ขาออก HTTP" ไม่ใช่ที่ฟังก์ชัน
 *
 * ทำไมต้องดักที่ fetch: บั๊ก 30 ต.ค. 69 ไม่ได้อยู่ในตรรกะของฟังก์ชันใดฟังก์ชันหนึ่ง
 * มันอยู่ที่ "ลำดับการเรียกระหว่างฟังก์ชัน" — ensureAccessGrant ไม่สร้างเพราะเห็น GRANTED
 * และ syncTradingViewGrant ไม่สั่งเพราะหา GRANTED ไม่เจอ ทั้งสองตัวทำงานถูกตามสเปคของตัวเอง
 * เทสต์ที่ mock ฟังก์ชันพวกนี้จึงจับไม่ได้ ต้องถามคำถามเดียวที่สำคัญคือ
 * **"บอทได้รับคำสั่งหรือไม่"** ซึ่งวัดได้ที่ขาออก HTTP เท่านั้น
 *
 * env ต้องตั้งก่อน import — tvAutoGrantEnabled/telegramGroupManaged อ่าน env
 * ตอนโหลดโมดูล ถ้า import ก่อนจะได้ false แล้วทุกอย่างจะถูกข้ามแบบเงียบ ๆ
 * (ซึ่งทำให้เทสต์ผ่านหมดโดยไม่ได้ทดสอบอะไรเลย — กับดักที่ต้องระวังที่สุดในไฟล์นี้)
 */
/**
 * ของเดิมที่ต้องคืนให้ครบตอนจบ — ต้องเก็บ "ก่อน" ทับด้วยค่าปลอมข้างล่าง
 *
 * ไฟล์นี้แก้ทั้ง process.env และ globalThis.fetch ซึ่งเป็นของทั้งโปรเซส
 * ตอนนี้มันรันท้ายสุด (เรียงตามชื่อไฟล์) จึงยังไม่กระทบใคร แต่พอมีไฟล์ UAT
 * ชื่อหลัง r- เพิ่มเข้ามา ไฟล์นั้นจะตื่นมาเจอ Telegram ที่ "เปิดอยู่" และ fetch ปลอม
 * แล้วพังแบบหาสาเหตุยากมาก — คืนของตอนจบจึงไม่ใช่ความเรียบร้อย แต่เป็นการกันบั๊ก
 */
const realFetch = globalThis.fetch;
const savedEnv = {
  TV_BOT_URL: process.env.TV_BOT_URL,
  TV_BOT_SECRET: process.env.TV_BOT_SECRET,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
};

process.env.TV_BOT_URL = "https://uat-bridge.invalid";
process.env.TV_BOT_SECRET = "uat-secret";
process.env.TELEGRAM_BOT_TOKEN = "uat:token";
process.env.TELEGRAM_CHAT_ID = "-1009999999";

interface OutCall {
  url: string;
  body: Record<string, unknown>;
}
const out: OutCall[] = [];
/** getChatMember จะตอบว่าอะไร — เปลี่ยนได้ต่อเทสต์ */
let memberStatus = "left";
let linkSeq = 0;

/**
 * ของเดิมที่ต้องคืนให้ครบตอนจบ
 *
 * ไฟล์นี้แก้ทั้ง process.env และ globalThis.fetch ซึ่งเป็นของทั้งโปรเซส
 * ตอนนี้มันรันท้ายสุด (เรียงตามชื่อไฟล์) จึงยังไม่กระทบใคร แต่พอมีไฟล์ UAT
 * ชื่อหลัง r- เพิ่มเข้ามา ไฟล์นั้นจะตื่นมาเจอ Telegram ที่ "เปิดอยู่" และ fetch ปลอม
 * แล้วพังแบบหาสาเหตุยากมาก — คืนของตอนจบจึงไม่ใช่ความเรียบร้อย แต่เป็นการกันบั๊ก
 */
const reply = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  let body: Record<string, unknown> = {};
  try {
    body = init?.body ? JSON.parse(String(init.body)) : {};
  } catch {
    /* ไม่ใช่ JSON ก็ไม่ต้องเก็บ */
  }
  out.push({ url, body });

  if (url.includes("api.telegram.org")) {
    const method = url.split("/").pop();
    if (method === "createChatInviteLink") {
      return reply({ ok: true, result: { invite_link: `https://t.me/+uat${++linkSeq}` } });
    }
    if (method === "getChatMember") return reply({ ok: true, result: { status: memberStatus } });
    return reply({ ok: true, result: {} });
  }
  // บริดจ์บอท TradingView — ตอบเหมือนของจริง คือ "รับงานเข้าคิวแล้ว"
  return reply({ ok: true, queued: true });
}) as typeof fetch;

const { activateMembership, ensureTelegramInvite, expireSubscription } = await import("@/lib/lifecycle");
const { runReconcile } = await import("@/lib/reconcile");
const { tvAutoGrantEnabled } = await import("@/lib/tradingview");
const { telegramGroupManaged } = await import("@/lib/telegram");
const { POST: callbackPOST } = await import("@/app/api/tradingview/callback/route");

const prisma = new PrismaClient();
const MARK = "uat-renewal";

/** คำสั่งที่ยิงถึงบริดจ์บอท (ไม่นับ Telegram) */
const botCalls = (path: "grant" | "revoke") =>
  out.filter((c) => c.url.startsWith(process.env.TV_BOT_URL!) && c.url.endsWith(`/${path}`));
const inviteCalls = () => out.filter((c) => c.url.endsWith("/createChatInviteLink"));

async function makeUser(tag: string, tvUsername: string | null = `tv_${tag}`) {
  return prisma.user.create({
    data: {
      email: `${tag}.${MARK}@uat.test`,
      name: `ต่ออายุ ${tag}`,
      passwordHash: "x",
      tradingViewUsername: tvUsername,
    },
  });
}

/** เปิดสิทธิ์รอบแรกให้เรียบร้อย แล้วปิดคิวเป็น GRANTED เหมือนที่บอททำสำเร็จจริง */
async function activatedMember(tag: string) {
  const user = await makeUser(tag);
  await activateMembership({
    userId: user.id,
    planCode: "MONTH",
    amountTHB: 990,
    providerRef: `${MARK}_${tag}_1`,
    provider: "web",
  });
  await prisma.accessGrant.updateMany({
    where: { userId: user.id },
    data: { status: "GRANTED", grantedAt: new Date(), note: "uat: บอทเพิ่มสำเร็จ" },
  });
  return user;
}

const renew = (userId: string, tag: string) =>
  activateMembership({
    userId,
    planCode: "MONTH",
    amountTHB: 990,
    providerRef: `${MARK}_${tag}_2`,
    provider: "line",
  });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.$disconnect();
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(() => {
  out.length = 0;
  memberStatus = "left";
});

describe("ด่านแรก — ของจำลองต้องเปิดใช้จริง", () => {
  it("ถ้า env ไม่ติด เทสต์ทั้งไฟล์จะผ่านลอย ๆ จึงต้องเช็กก่อน", () => {
    expect(tvAutoGrantEnabled).toBe(true);
    expect(telegramGroupManaged).toBe(true);
  });
});

describe("R-1 · ต่ออายุก่อนหมดอายุ (คิวเป็น GRANTED)", () => {
  it("บอทต้องได้รับคำสั่งต่ออายุ — นี่คือบั๊กตัวจริงของ 30 ต.ค. 69", async () => {
    const user = await activatedMember("before");
    // บีบให้เหลือ 5 วัน = ต่ออายุล่วงหน้าแบบที่ลูกค้าทำจริง
    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { currentPeriodEnd: new Date(Date.now() + 5 * 864e5) },
    });
    out.length = 0;

    await renew(user.id, "before");

    const grants = botCalls("grant");
    expect(grants).toHaveLength(1);
    expect(grants[0].body.username).toBe("tv_before");
  });

  it("จำนวนวันที่สั่งต้องรวมวันที่ทบให้ ไม่ใช่ 30 วันถ้วน", async () => {
    const user = await activatedMember("days");
    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { currentPeriodEnd: new Date(Date.now() + 5 * 864e5) },
    });
    out.length = 0;

    await renew(user.id, "days");

    // เหลือ 5 วัน + 1 เดือน = 33-36 วันแล้วแต่เดือน · ขอแค่ "มากกว่า 1 เดือนเปล่า ๆ"
    // เพราะยืนยันตัวเลขเป๊ะจะล้มทุกเดือน ก.พ. (บทเรียนจาก E-4 ในชุด membership)
    expect(botCalls("grant")[0].body.days).toBeGreaterThan(31);
  });

  it("ต่ออายุซ้ำหลายรอบต้องไม่สร้างคิวบานปลาย", async () => {
    const user = await activatedMember("dup");
    await renew(user.id, "dup");
    await activateMembership({
      userId: user.id,
      planCode: "MONTH",
      amountTHB: 990,
      providerRef: `${MARK}_dup_3`,
      provider: "line",
    });

    // คิวเดิมถูกใช้ซ้ำ ไม่ใช่สร้างใบใหม่ทุกรอบ — ไม่งั้นหน้าคิวแอดมินจะอ่านไม่ได้
    expect(await prisma.accessGrant.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("R-2 · ต่ออายุหลังหมดอายุ (เส้นทางที่เคยทำงานอยู่แล้ว)", () => {
  it("ยังต้องสั่งบอทได้เหมือนเดิม — ห้าม regress", async () => {
    const user = await activatedMember("after");
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: new Date(Date.now() - 864e5) },
    });
    await expireSubscription(await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }));
    out.length = 0;

    await renew(user.id, "after");

    expect(botCalls("grant")).toHaveLength(1);
    const now = await prisma.accessGrant.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(["PENDING", "GRANTED"]).toContain(now?.status);
  });
});

describe("R-3 · คิวถอนที่ค้างต้องไม่ถอนสิทธิ์คนที่เพิ่งจ่ายเงิน", () => {
  it("มี PENDING_REVOKE ค้าง + ต่ออายุ แล้ว reconcile ต้องไม่สั่งถอน", async () => {
    const user = await activatedMember("stale");
    // สภาพจริงตอนหมดอายุแล้วบอทถอนไม่สำเร็จ: คิวค้าง PENDING_REVOKE และเก่าพอให้ reconcile หยิบ
    const old = new Date(Date.now() - 60 * 60_000);
    await prisma.accessGrant.updateMany({
      where: { userId: user.id },
      data: { status: "PENDING_REVOKE", createdAt: old, note: "uat: บอทถอนไม่สำเร็จ" },
    });

    await renew(user.id, "stale");

    // ต้องไม่เหลือคิวถอนค้างอยู่เลย
    expect(
      await prisma.accessGrant.count({ where: { userId: user.id, status: "PENDING_REVOKE" } })
    ).toBe(0);

    out.length = 0;
    await runReconcile();

    const revokedThisUser = botCalls("revoke").filter((c) => c.body.username === "tv_stale");
    expect(revokedThisUser).toHaveLength(0);
  });
});

describe("R-4 · กลุ่ม Telegram ตอนต่ออายุ", () => {
  it('สถานะ ADDED แต่ออกจากกลุ่มไปแล้ว ต้องออกลิงก์ใหม่และล้างร่องรอยการส่งอีเมล', async () => {
    const user = await activatedMember("tgout");
    memberStatus = "left";
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: {
        status: "ADDED",
        telegramUserId: "777",
        inviteLink: "https://t.me/+dead",
        invitedAt: new Date(Date.now() - 40 * 864e5),
        notifiedAt: new Date(Date.now() - 40 * 864e5),
        chatId: process.env.TELEGRAM_CHAT_ID,
        addedAt: new Date(Date.now() - 40 * 864e5),
      },
    });
    out.length = 0;

    await ensureTelegramInvite(user.id);

    expect(inviteCalls()).toHaveLength(1);
    const tg = await prisma.telegramGrant.findFirstOrThrow({ where: { userId: user.id } });
    expect(tg.inviteLink).not.toBe("https://t.me/+dead");
    // ไม่ล้าง notifiedAt = ใบใหม่นอนในฐานข้อมูลโดยไม่มีใครส่งให้ลูกค้า
    expect(tg.notifiedAt).toBeNull();
  });

  it("ยังอยู่ในกลุ่มจริง ต้องไม่ออกลิงก์ใหม่ทับ", async () => {
    const user = await activatedMember("tgin");
    memberStatus = "member";
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: { status: "ADDED", telegramUserId: "888", chatId: process.env.TELEGRAM_CHAT_ID },
    });
    out.length = 0;

    await ensureTelegramInvite(user.id);

    expect(inviteCalls()).toHaveLength(0);
  });

  it("ลิงก์ที่ยังไม่หมดอายุต้องไม่ถูกออกใหม่ทับ — ใบที่ส่งอีเมลไปแล้วจะใช้ไม่ได้", async () => {
    const user = await activatedMember("tgfresh");
    memberStatus = "left";
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: {
        status: "PENDING",
        inviteLink: "https://t.me/+fresh",
        invitedAt: new Date(Date.now() - 864e5),
        chatId: process.env.TELEGRAM_CHAT_ID,
      },
    });
    out.length = 0;

    await ensureTelegramInvite(user.id);

    expect(inviteCalls()).toHaveLength(0);
    const tg = await prisma.telegramGrant.findFirstOrThrow({ where: { userId: user.id } });
    expect(tg.inviteLink).toBe("https://t.me/+fresh");
  });
});

describe("R-5 · ผลจากบอทต้องลงแถวที่ถูกสั่งจริง", () => {
  it("ต่ออายุรอบสองที่มีแถว REVOKED เก่าค้าง ผลต้องไม่ไปลงแถวเก่า", async () => {
    const user = await activatedMember("cb");
    // สภาพจริงของคนที่หมดอายุไปรอบหนึ่งแล้วกลับมาต่อ: มีแถว REVOKED เก่ากับแถว GRANTED ใหม่
    const current = await prisma.accessGrant.findFirstOrThrow({ where: { userId: user.id } });
    const stale = await prisma.accessGrant.create({
      data: {
        userId: user.id,
        status: "REVOKED",
        tradingViewUsername: "tv_cb",
        revokedAt: new Date(Date.now() - 90 * 864e5),
        note: "uat: รอบที่หมดอายุไปแล้ว",
      },
    });
    // แถวเก่าต้อง "ใหม่กว่า" ในสายตา orderBy desc ไม่ได้ — บีบ createdAt ให้ถูกลำดับจริง
    await prisma.accessGrant.update({
      where: { id: stale.id },
      data: { createdAt: new Date(Date.now() - 90 * 864e5) },
    });
    await prisma.accessGrant.update({
      where: { id: current.id },
      data: { createdAt: new Date(Date.now() - 1 * 864e5) },
    });

    await renew(user.id, "cb");

    const res = await callbackPOST(
      new Request("https://uat.test/api/tradingview/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: process.env.TV_BOT_SECRET,
          action: "grant",
          username: "tv_cb",
          ok: true,
        }),
      })
    );
    expect(res.status).toBe(200);

    const after = await prisma.accessGrant.findUniqueOrThrow({ where: { id: current.id } });
    const untouched = await prisma.accessGrant.findUniqueOrThrow({ where: { id: stale.id } });
    expect(after.status).toBe("GRANTED");
    expect(untouched.status).toBe("REVOKED");
  });
});
