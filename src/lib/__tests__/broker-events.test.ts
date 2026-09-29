import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { parseBrokerEmail, classify, checkEvidence, compareNames } = await import("@/lib/broker-events");

const AT = new Date("2026-09-27T10:00:00Z");
const parse = (subject: string, body: string) => parseBrokerEmail({ subject, body, receivedAt: AT });

/**
 * คุมสองอย่าง: อ่านอีเมลจริงของ Wisdom ได้ (ชุด "อีเมลจริงจาก Wisdom" ด้านล่าง)
 * และ **อ่านผิดแล้วต้องไม่เดามั่ว** — เดาเลขบัญชีผิดอันตรายกว่าอ่านไม่ออก
 * เพราะจะไปโชว์เป็นหลักฐานของคนอื่น
 */
describe("แยกชนิดเหตุการณ์", () => {
  it("จากหัวข้ออีเมล", () => {
    expect(classify("New Client Registration", "")).toBe("SIGNUP");
    expect(classify("Deposit Confirmation", "")).toBe("DEPOSIT");
    expect(classify("Withdrawal Processed", "")).toBe("WITHDRAWAL");
    expect(classify("แจ้งเตือน: ลูกค้าฝากเงิน", "")).toBe("DEPOSIT");
    expect(classify("เปิดบัญชีใหม่", "")).toBe("SIGNUP");
  });

  it("หัวข้อสำคัญกว่าเนื้อ (เนื้อมักมีคำอื่นปน)", () => {
    expect(classify("Deposit received", "This account registered last week")).toBe("DEPOSIT");
  });

  it("แยกไม่ออก = UNKNOWN ไม่เดา", () => {
    expect(classify("Monthly newsletter", "Hello trader")).toBe("UNKNOWN");
  });
});

describe("อ่านเลขบัญชี", () => {
  it("รูปแบบที่มีป้ายกำกับ", () => {
    for (const s of [
      "Account Number: 12345678",
      "account no. 12345678",
      "Login: 12345678",
      "MT5 12345678",
      "เลขบัญชี 12345678",
      "Trading Account #12345678",
    ]) {
      expect(parse(s, "").tradingAccount, s).toBe("12345678");
    }
  });

  it("ไม่มีป้ายกำกับ = เอาเลขยาวที่โดดเดี่ยว", () => {
    expect(parse("New client", "Welcome, your account 98765432 is ready").tradingAccount).toBe("98765432");
  });

  it("ห้ามหยิบยอดเงินมาเป็นเลขบัญชี", () => {
    const got = parse("Deposit", "Amount: 150.00 USD has been credited");
    expect(got.tradingAccount).toBeNull();
    expect(got.amountUSD).toBe(150);
  });

  it("ห้ามหยิบตัวเลขจากยอดที่มีลูกน้ำ", () => {
    expect(parse("Deposit", "Deposit of 12,500.00 USD completed").tradingAccount).toBeNull();
  });

  it("มีทั้งเลขบัญชีและยอด = แยกถูกทั้งคู่", () => {
    const got = parse("Deposit Confirmation", "Account: 50123456\nAmount: $1,250.50\nStatus: completed");
    expect(got).toMatchObject({ type: "DEPOSIT", tradingAccount: "50123456", amountUSD: 1250.5 });
  });

  it("เลขสั้นเกินไปไม่ใช่เลขบัญชี", () => {
    expect(parse("Deposit", "Reference 123 completed").tradingAccount).toBeNull();
  });
});

describe("อ่านยอดเงิน", () => {
  it("รูปแบบที่พบบ่อย", () => {
    expect(parse("Deposit", "Amount: $150").amountUSD).toBe(150);
    expect(parse("Deposit", "150 USD").amountUSD).toBe(150);
    expect(parse("Deposit", "USD 1,500.75").amountUSD).toBe(1500.75);
    expect(parse("Deposit", "ยอด 200 USD").amountUSD).toBe(200);
  });

  it("ไม่มียอด = null ไม่ใช่ 0 (0 แปลว่าฝากศูนย์บาท ซึ่งคนละเรื่อง)", () => {
    expect(parse("New client", "Account: 12345678").amountUSD).toBeNull();
  });
});

describe("อ่านชื่อและอีเมล", () => {
  it("ป้ายชื่อและอีเมลลูกค้า", () => {
    const got = parse("New Client", "Name: Somchai Jaidee\nEmail: somchai@example.com\nAccount: 12345678");
    expect(got).toMatchObject({ accountName: "Somchai Jaidee", accountEmail: "somchai@example.com" });
  });

  it("ตัดลายเซ็นท้ายอีเมลทิ้ง ไม่หยิบอีเมลบริษัทมาเป็นของลูกค้า", () => {
    const got = parse(
      "Deposit",
      "Account: 12345678\nEmail: client@example.com\n\n--\nWisdom Support\nsupport@wisdomtrade.com"
    );
    expect(got.accountEmail).toBe("client@example.com");
  });

  it("ไม่มีชื่อ = null ไม่เดาจากข้อความอื่น", () => {
    expect(parse("Deposit", "Account: 12345678\nAmount: $100").accountName).toBeNull();
  });
});

describe("ตัวอย่างอีเมลเต็มฉบับ", () => {
  it("แจ้งลูกค้าใหม่", () => {
    const body = `Dear Partner,

A new client has registered under your referral link.

Client Name: Anong Srisuk
Email: anong.s@example.com
Account Number: 70012345
Registration Date: 27 Sep 2026

Wisdom Financial Services`;
    expect(parse("New Client Registration - Wisdom", body)).toMatchObject({
      type: "SIGNUP",
      tradingAccount: "70012345",
      accountName: "Anong Srisuk",
      accountEmail: "anong.s@example.com",
    });
  });

  it("แจ้งการฝากเงิน", () => {
    const body = `Deposit notification

Account: 70012345
Client: Anong Srisuk
Amount: USD 250.00
Method: Bank transfer`;
    expect(parse("Deposit Confirmation", body)).toMatchObject({
      type: "DEPOSIT",
      tradingAccount: "70012345",
      amountUSD: 250,
    });
  });

  it("อีเมลที่ไม่เกี่ยว = UNKNOWN และไม่แต่งเลขบัญชี", () => {
    const got = parse("Platform maintenance notice", "Dear trader, our servers will be down on Sunday.");
    expect(got.type).toBe("UNKNOWN");
    expect(got.tradingAccount).toBeNull();
  });
});

/**
 * รูปแบบจริงจากกล่อง QVXofficial09 (30 ก.ย. 2569) — เปลี่ยนแค่ชื่อกับเลขบัญชี
 * สังเกต: โคลอนตัวเต็ม "：" · ชื่อเรียง "นามสกุล ชื่อ" · มี \r ปน
 * · ไม่มีอีเมลลูกค้า มีแต่อีเมลบริษัท admin@wisdomfinancialservice.com
 */
describe("อีเมลจริงจาก Wisdom", () => {
  const wrap = (title: string, lines: string) => ` 邮件通知 \r
  ﻿\r
 ${title}
 admin@wisdomfinancialservice.com
Wisdom Financial service Limited\r
 QVX Official,
${lines}
 เว็บไซต์ของบริษัท： https://wisdomfinancialservice.com/ / โทรศัพท์บริษัท： / กล่องจดหมายบริษัท： admin@wisdomfinancialservice.com
 ที่อยู่บริษัท： Ground Floor, The Sotheby Building, Rodney Village, Rodney Bay, Gros-Islet, Saint Lucia\r
 เค ล็ดลับความเสี่ยง： \r
 COPYRIGHT © 2023 版权所有`;

  it("ลูกค้าเปิดบัญชีเทรดใต้ QVX = สมัคร + เลขบัญชี + ชื่อ", () => {
    const subject = "บัญชีธุรกรรมล่างสำเร็จแล้ว";
    const body = wrap(
      subject,
      ` บัญชีธุรกรรมล่างของคุณเปิดบัญชีผู้ใช้แล้ว。
 ชื่อ：Srisuk Anong
 บัญชีผู้ใช้สำหรับการเทรด： 209911
 พร็อกซี ที่มีสิทธิ：QVX Official
 เซิร์ฟเวอร์：WisdomFinancial-Server`
    );
    expect(parse(subject, body)).toMatchObject({
      type: "SIGNUP",
      tradingAccount: "209911",
      accountName: "Srisuk Anong",
      accountEmail: null,
      amountUSD: null,
    });
  });

  it("ลูกค้าฝากเงิน = ยอดเงินกับเลขบัญชีถูก", () => {
    const subject = "ผู้ใต้บังคับบัญชาฝากเงินสำเร็จ";
    const body = wrap(
      subject,
      ` ผู้ใช้รายย่อยของคุณฝากเงินสำเร็จแล้ว。
 ชื่อ：Srisuk Anong
 บัญชีผู้ใช้สำหรับการเทรด： 209911
 พร็อกซี ที่มีสิทธิ：QVX Official
 วิธีการฝากเงิน：Third party payment
 จำนวนเงินฝาก：100.00 USD
 เวลาฝาก：2026-09-30 01:28:58`
    );
    expect(parse(subject, body)).toMatchObject({
      type: "DEPOSIT",
      tradingAccount: "209911",
      accountName: "Srisuk Anong",
      amountUSD: 100,
      accountEmail: null,
    });
  });

  it("สมัครผู้ใช้แต่ยังไม่มีบัญชีเทรด = สมัคร ไม่มีเลขบัญชี ไม่หยิบปีมาเป็นเลขบัญชี", () => {
    const subject = "ผู้ใช้ใหม่ลงทะเบียนเรียบร้อยแล้ว";
    const body = wrap(
      subject,
      ` เชิญผู้ใช้ใหม่ให้ลงทะเบียนสำเร็จแล้ว。
 ชื่อ：Srisuk Anong
 ผู้บังคับบัญชาโดยตรง：QVX Official
 เวลาลงทะเบียน：2026-09-30 01:10:45`
    );
    expect(parse(subject, body)).toMatchObject({
      type: "SIGNUP",
      tradingAccount: null,
      accountName: "Srisuk Anong",
      accountEmail: null,
    });
  });

  it("อีเมลบริษัทของโบรกไม่ใช่อีเมลลูกค้า (เคยทำหน้าตรวจขึ้นอีเมลไม่ตรงกับทุกคน)", () => {
    expect(parse("Deposit", "Account: 12345678\nsupport@mail.wisdomtrade.com\nadmin@wisdomfinancialservice.com").accountEmail).toBeNull();
    expect(parse("Deposit", "admin@wisdomfinancialservice.com\nEmail: client@example.com").accountEmail).toBe("client@example.com");
  });
});

describe("เทียบชื่อ", () => {
  it("ไม่สนลำดับคำ (Wisdom เรียงนามสกุลก่อน)", () => {
    expect(compareNames("Srisuk Anong", "anong  srisuk")).toBe(true);
  });

  it("ภาษาเดียวกันแต่คนละชื่อ = ไม่ผ่าน", () => {
    expect(compareNames("Srisuk Anong", "Somchai Jaidee")).toBe(false);
  });

  it("คนละภาษา = ให้คนเทียบเอง ไม่ขึ้นว่าไม่ผ่าน", () => {
    expect(compareNames("Srisuk Anong", "อนงค์ ศรีสุข")).toBeNull();
  });
});

describe("เทียบหลักฐานกับเงื่อนไข", () => {
  const base = { minDepositUSD: 100, customerName: "Anong Srisuk", customerEmail: "anong.s@example.com" };
  const ev = (over: Partial<Parameters<typeof checkEvidence>[0]> = {}) => ({
    signupAt: new Date("2026-09-20T00:00:00Z"),
    depositTotalUSD: 250,
    withdrawalTotalUSD: 0,
    netUSD: 250,
    accountName: "Anong Srisuk",
    accountEmail: "anong.s@example.com",
    events: [{ id: "1", type: "DEPOSIT", amountUSD: 250, occurredAt: new Date(), source: "email" }],
    ...over,
  });

  it("ครบทุกข้อ = ผ่าน", () => {
    expect(checkEvidence(ev(), base).ok).toBe(true);
  });

  it("ไม่มีข้อมูลจากโบรกเลย = ไม่ผ่าน และบอกให้ไปเช็กเอง", () => {
    const r = checkEvidence(undefined, base);
    expect(r.ok).toBe(false);
    expect(r.lines[0].detail).toContain("ต้องเปิดหลังบ้านโบรกเช็กเอง");
  });

  it("ฝากแล้วถอนออกจนเหลือไม่ถึงขั้นต่ำ = ไม่ผ่าน (ดูยอดคงเหลือ ไม่ใช่ยอดฝากรวม)", () => {
    const r = checkEvidence(ev({ depositTotalUSD: 250, withdrawalTotalUSD: 200, netUSD: 50 }), base);
    expect(r.ok).toBe(false);
    expect(r.lines.find((l) => l.label.includes("ยอดคงเหลือ"))?.ok).toBe(false);
  });

  it("ชื่อไม่ตรง = ไม่ผ่าน (กันคนเอาเลขบัญชีคนอื่นมาแจ้ง)", () => {
    expect(checkEvidence(ev(), { ...base, customerName: "คนอื่น" }).ok).toBe(false);
  });

  it("โบรกไม่บอกอีเมลลูกค้า (แบบ Wisdom) = ไม่มีข้ออีเมล และยังผ่านครบได้", () => {
    const r = checkEvidence(ev({ accountEmail: null, accountName: "Srisuk Anong" }), {
      ...base,
      customerName: "Anong Srisuk",
    });
    expect(r.lines.some((l) => l.label.includes("อีเมล"))).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("อีเมลไม่บอกชื่อ = ค้างไว้ (null) ไม่ตัดสินว่าผ่านหรือไม่ผ่าน", () => {
    const r = checkEvidence(ev({ accountName: null }), base);
    expect(r.lines.find((l) => l.label.includes("ชื่อ"))?.ok).toBeNull();
    expect(r.ok).toBe(false);
  });
});
