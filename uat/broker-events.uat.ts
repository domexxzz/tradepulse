import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { evidenceFor, recordEmailEvent, parseBrokerEmail, checkEvidence } from "@/lib/broker-events";
import { BROKER_EVENT_TYPE as T } from "@/config/status";

/**
 * หลักฐานจากโบรก · ชนฐานข้อมูลจริง
 *
 * จุดที่พลาดแล้วเสียของจริง: บันทึกอีเมลซ้ำจนยอดฝากบวกสองเท่า (แล้วคนผ่านเงื่อนไขทั้งที่ไม่ควร)
 * และหลักฐานของบัญชีหนึ่งไปโผล่ในอีกบัญชี
 */

const prisma = new PrismaClient();
const ACC_A = "9911001122";
const ACC_B = "9911003344";

async function cleanup() {
  await prisma.brokerEvent.deleteMany({ where: { tradingAccount: { in: [ACC_A, ACC_B] } } });
  await prisma.brokerEvent.deleteMany({ where: { externalId: { startsWith: "<uat-" } } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const emailEvent = (opts: { subject: string; body: string; id: string | null; at?: Date }) =>
  recordEmailEvent({
    parsed: parseBrokerEmail({ subject: opts.subject, body: opts.body, receivedAt: opts.at ?? new Date() }),
    externalId: opts.id,
    rawText: `${opts.subject}\n${opts.body}`,
  });

describe("E-1 · บันทึกอีเมล", () => {
  it("อ่านอีเมลฝากเงินแล้วเก็บยอดกับเลขบัญชีถูก", async () => {
    const r = await emailEvent({
      subject: "Deposit Confirmation",
      body: `Account: ${ACC_A}\nClient: Somchai Test\nEmail: somchai@uat.test\nAmount: USD 250.00`,
      id: "<uat-dep-1@wisdom>",
    });
    expect(r.created).toBe(true);
    const row = await prisma.brokerEvent.findUnique({ where: { externalId: "<uat-dep-1@wisdom>" } });
    expect(row).toMatchObject({ type: T.DEPOSIT, tradingAccount: ACC_A, amountUSD: 250, source: "email" });
  });

  it("อีเมลฉบับเดิมส่งซ้ำ = ไม่เกิดแถวใหม่ (บอทอ่านกล่องซ้ำได้)", async () => {
    const again = await emailEvent({
      subject: "Deposit Confirmation",
      body: `Account: ${ACC_A}\nAmount: USD 250.00`,
      id: "<uat-dep-1@wisdom>",
    });
    expect(again.created).toBe(false);
    expect(await prisma.brokerEvent.count({ where: { externalId: "<uat-dep-1@wisdom>" } })).toBe(1);
  });

  it("ไม่มี Message-ID ก็ยังเก็บได้ (อีเมลบางฉบับไม่มี)", async () => {
    const r = await emailEvent({ subject: "Deposit", body: `Account: ${ACC_A}\nAmount: $10`, id: null });
    expect(r.created).toBe(true);
  });

  it("อ่านไม่ออกก็ไม่ทิ้ง — เก็บเป็น UNKNOWN พร้อมข้อความดิบให้คนดู", async () => {
    await emailEvent({ subject: "Platform maintenance", body: "Servers down Sunday", id: "<uat-unknown@wisdom>" });
    const row = await prisma.brokerEvent.findUnique({ where: { externalId: "<uat-unknown@wisdom>" } });
    expect(row?.type).toBe(T.UNKNOWN);
    expect(row?.tradingAccount).toBeNull();
    expect(row?.rawText).toContain("maintenance");
  });
});

describe("E-2 · รวมหลักฐานรายบัญชี", () => {
  it("ยอดคงเหลือ = ฝาก - ถอน และแยกบัญชีไม่ปนกัน", async () => {
    await emailEvent({
      subject: "New Client Registration",
      body: `Account Number: ${ACC_B}\nClient Name: Anong Test\nEmail: anong@uat.test`,
      id: "<uat-sign-b@wisdom>",
      at: new Date("2026-09-20T00:00:00Z"),
    });
    await emailEvent({ subject: "Deposit", body: `Account: ${ACC_B}\nAmount: $500`, id: "<uat-dep-b@wisdom>" });
    await emailEvent({ subject: "Withdrawal", body: `Account: ${ACC_B}\nAmount: $120`, id: "<uat-wd-b@wisdom>" });

    const ev = await evidenceFor([ACC_A, ACC_B]);
    const b = ev.get(ACC_B)!;
    expect(b.depositTotalUSD).toBe(500);
    expect(b.withdrawalTotalUSD).toBe(120);
    expect(b.netUSD).toBe(380);
    expect(b.signupAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(b.accountName).toBe("Anong Test");
    // บัญชี A ไม่ได้รับผลจากเหตุการณ์ของ B
    expect(ev.get(ACC_A)!.withdrawalTotalUSD).toBe(0);
  });

  it("บัญชีที่ไม่มีเหตุการณ์เลย = ไม่ผ่าน และบอกให้ไปเช็กเอง", async () => {
    const ev = await evidenceFor(["9911009999"]);
    const check = checkEvidence(ev.get("9911009999"), {
      minDepositUSD: 100,
      customerName: "ใครสักคน",
      customerEmail: "x@uat.test",
    });
    expect(check.ok).toBe(false);
    expect(check.lines[0].detail).toContain("เช็กเอง");
  });

  it("ครบเงื่อนไข + ชื่ออีเมลตรง = ผ่านทุกข้อ", async () => {
    const ev = await evidenceFor([ACC_B]);
    const check = checkEvidence(ev.get(ACC_B), {
      minDepositUSD: 100,
      customerName: "Anong Test",
      customerEmail: "anong@uat.test",
    });
    expect(check.ok).toBe(true);
  });

  it("ถอนจนเหลือต่ำกว่าขั้นต่ำ = ข้อยอดคงเหลือไม่ผ่าน", async () => {
    await emailEvent({ subject: "Withdrawal", body: `Account: ${ACC_B}\nAmount: $350`, id: "<uat-wd-b2@wisdom>" });
    const ev = await evidenceFor([ACC_B]);
    expect(ev.get(ACC_B)!.netUSD).toBe(30);
    const check = checkEvidence(ev.get(ACC_B), {
      minDepositUSD: 100,
      customerName: "Anong Test",
      customerEmail: "anong@uat.test",
    });
    expect(check.ok).toBe(false);
    expect(check.lines.find((l) => l.label.includes("ยอดคงเหลือ"))?.ok).toBe(false);
  });
});
