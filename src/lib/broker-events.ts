import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BROKER_EVENT_TYPE as T, type BrokerEventType } from "@/config/status";
import { DEFAULT_BROKER, TRADING_ACCOUNT_RE } from "@/config/brokers";

/**
 * เหตุการณ์จากโบรก (สมัคร / ฝาก / ถอน) — หลักฐานประกอบการอนุมัติคำขอรับสิทธิ์ผ่าน Wisdom
 *
 * Wisdom ไม่มี API ให้เชื่อม (ถามแล้ว 27 ก.ย. 2569) ช่องทางที่ได้คืออีเมลแจ้งเตือน
 * ที่พาร์ตเนอร์ส่งต่อมา + พาร์ตเนอร์บันทึกเองจากหลังบ้านโบรก
 *
 * ตัวอ่านอีเมลเขียนแบบ "เดาให้ดีที่สุด" เพราะยังไม่เคยเห็นอีเมลจริงสักฉบับ
 * อ่านไม่ออกก็ไม่ทิ้ง — เก็บเป็น UNKNOWN พร้อมข้อความดิบให้คนเปิดดู แล้วค่อยปรับ pattern
 * (ดู docs/WISDOM.md หัวข้อ "อีเมลแจ้งเตือนจากโบรก")
 */

export type ParsedEmail = {
  type: BrokerEventType;
  tradingAccount: string | null;
  accountName: string | null;
  accountEmail: string | null;
  amountUSD: number | null;
  occurredAt: Date;
};

/**
 * \b ใช้กับภาษาไทยไม่ได้ — JS มองตัวอักษรไทยเป็น "ไม่ใช่ตัวอักษร" ขอบคำเลยไม่เกิด
 * (เจอตอนเทสต์: /\bฝากเงิน\b/ ไม่แมตช์ "ลูกค้าฝากเงิน") จึงแยกคำไทยออกมาไม่ใส่ \b
 */
const CLASSIFIERS: Array<[BrokerEventType, RegExp]> = [
  [T.SIGNUP, /\b(new\s+(client|account|registration|sign-?up)|registered)\b|บัญชีใหม่|สมัครใหม่|เปิดบัญชี|ลงทะเบียน/i],
  [T.DEPOSIT, /\b(deposit|funded|funding|top-?up)\b|ฝากเงิน|เติมเงิน/i],
  [T.WITHDRAWAL, /\b(withdraw\w*|payout)\b|ถอนเงิน|ถอน/i],
];

/** เลขบัญชีเทรด — มองหาป้ายกำกับก่อน ถ้าไม่เจอค่อยเดาจากเลขโดด ๆ ที่ยาวพอ */
const ACCOUNT_LABELS =
  /(?:account(?:\s*(?:no|number|id|#))?|login|mt5|trading\s*account|เลขบัญชี|บัญชีเทรด|พอร์ต)\s*[:#]?\s*(\d{4,20})/i;

/** จำนวนเงิน — รองรับ "$150", "150 USD", "USD 150.50", "1,500.00" */
const AMOUNT =
  /(?:(?:amount|deposit(?:ed)?|sum|จำนวน|ยอด)\s*[:=]?\s*)?(?:\$|\bUSD\s*)([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|\$)/i;

const EMAIL = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/;
/**
 * ชื่อเจ้าของบัญชี — อ่านทีละบรรทัดและบังคับว่าต้องมี ":" หลังป้าย
 * ห้ามใช้ \s* หลังป้าย เพราะ \s กินขึ้นบรรทัดใหม่ แล้วไปคว้าบรรทัดถัดไปมาเป็นชื่อ
 * (เจอตอนเทสต์: "New Client\nName: Somchai" ได้ชื่อเป็น "Name: Somchai")
 * เรียงจากป้ายเฉพาะเจาะจงไปกว้าง — "Client Name" ต้องชนะ "Client"
 */
const NAME_LABELS = [/^[ \t]*client\s*name[ \t]*[:#][ \t]*(.+)$/im, /^[ \t]*(?:account\s*)?name[ \t]*[:#][ \t]*(.+)$/im, /^[ \t]*(?:client|customer)[ \t]*[:#][ \t]*(.+)$/im, /^[ \t]*(?:ชื่อลูกค้า|ชื่อ|ลูกค้า)[ \t]*[:#][ \t]*(.+)$/im];

function findName(text: string): string | null {
  for (const re of NAME_LABELS) {
    const raw = text.match(re)?.[1]?.trim();
    // ตัดค่าที่ไม่ใช่ชื่อคน: มีอีเมล มีตัวเลขล้วน หรือยาวผิดปกติ
    if (raw && raw.length >= 2 && raw.length <= 60 && !raw.includes("@") && !/^\d+$/.test(raw)) return raw;
  }
  return null;
}

const num = (s: string) => {
  const v = Number(s.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
};

/** ตัดลายเซ็น/ข้อความท้ายอีเมลออก — ส่วนนั้นมีอีเมลบริษัทปนทำให้จับผิดตัว */
function trimQuoted(text: string): string {
  const cut = text.search(/^\s*(--\s*$|On .+ wrote:|-{5,}\s*Original Message)/m);
  return cut > 0 ? text.slice(0, cut) : text;
}

export function classify(subject: string, body: string): BrokerEventType {
  // หัวข้อชี้ชัดกว่าเนื้อ — เนื้ออีเมลมักมีคำอื่นปนจนสับสน
  for (const [type, re] of CLASSIFIERS) if (re.test(subject)) return type;
  for (const [type, re] of CLASSIFIERS) if (re.test(body)) return type;
  return T.UNKNOWN;
}

/**
 * อ่านอีเมลแจ้งเตือนหนึ่งฉบับ — คืนค่าที่อ่านได้เท่าที่เจอ (ช่องไหนไม่เจอเป็น null)
 * @param receivedAt เวลาที่อีเมลเข้ามา ใช้เป็นเวลาเหตุการณ์เมื่อในอีเมลไม่มีวันที่
 */
export function parseBrokerEmail(input: {
  subject: string;
  body: string;
  receivedAt: Date;
}): ParsedEmail {
  const subject = (input.subject || "").slice(0, 500);
  const body = trimQuoted((input.body || "").slice(0, 20_000));
  const hay = `${subject}\n${body}`;

  const labelled = hay.match(ACCOUNT_LABELS)?.[1] ?? null;
  // ไม่มีป้ายกำกับ: เอาเลขยาว 5-20 หลักที่ไม่ติดกับจุดทศนิยม (กันไปหยิบยอดเงินมาเป็นเลขบัญชี)
  const bare = labelled ? null : hay.match(/(?<![\d.,])(\d{5,20})(?![\d.,])/)?.[1] ?? null;
  const tradingAccount = [labelled, bare].find((v) => v && TRADING_ACCOUNT_RE.test(v)) ?? null;

  const amountMatch = hay.match(AMOUNT);
  const amountUSD = amountMatch ? num(amountMatch[1] ?? amountMatch[2] ?? "") : null;

  const name = findName(hay);

  return {
    type: classify(subject, body),
    tradingAccount,
    accountName: name,
    accountEmail: hay.match(EMAIL)?.[1]?.toLowerCase() ?? null,
    // ถอนเงินไม่ต้องรู้ยอดก็ได้ แต่ฝากเงินยอดสำคัญ (ใช้ตัดสินเงื่อนไขขั้นต่ำ)
    amountUSD: amountUSD !== null && amountUSD > 0 ? amountUSD : null,
    occurredAt: input.receivedAt,
  };
}

/**
 * บันทึกเหตุการณ์จากอีเมล — กันซ้ำด้วย Message-ID
 * คืน created=false เมื่อเคยบันทึกอีเมลฉบับนี้แล้ว (บอทอ่านซ้ำได้โดยไม่เกิดข้อมูลซ้ำ)
 */
export async function recordEmailEvent(input: {
  parsed: ParsedEmail;
  externalId: string | null;
  rawText: string;
  broker?: string;
}): Promise<{ created: boolean; id: string }> {
  const data = {
    broker: input.broker ?? DEFAULT_BROKER,
    type: input.parsed.type,
    tradingAccount: input.parsed.tradingAccount,
    accountName: input.parsed.accountName,
    accountEmail: input.parsed.accountEmail,
    amountUSD: input.parsed.amountUSD,
    occurredAt: input.parsed.occurredAt,
    source: "email",
    externalId: input.externalId,
    rawText: input.rawText.slice(0, 10_000),
  };
  if (!input.externalId) {
    const row = await prisma.brokerEvent.create({ data, select: { id: true } });
    return { created: true, id: row.id };
  }
  try {
    const row = await prisma.brokerEvent.create({ data, select: { id: true } });
    return { created: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.brokerEvent.findUnique({
        where: { externalId: input.externalId },
        select: { id: true },
      });
      if (existing) return { created: false, id: existing.id };
    }
    throw e;
  }
}

export type AccountEvidence = {
  signupAt: Date | null;
  depositTotalUSD: number;
  withdrawalTotalUSD: number;
  /** ฝาก - ถอน — เงื่อนไขขั้นต่ำควรดูยอดคงเหลือ ไม่ใช่ยอดฝากรวม (ฝากแล้วถอนออกทันทีไม่ควรผ่าน) */
  netUSD: number;
  accountName: string | null;
  accountEmail: string | null;
  events: Array<{ id: string; type: string; amountUSD: number | null; occurredAt: Date; source: string }>;
};

/** รวมหลักฐานของเลขบัญชีชุดหนึ่ง — ใช้ครั้งเดียวตอนเปิดหน้าคิว ไม่ยิงทีละแถว */
export async function evidenceFor(accounts: string[]): Promise<Map<string, AccountEvidence>> {
  const unique = [...new Set(accounts.filter(Boolean))];
  const out = new Map<string, AccountEvidence>();
  if (!unique.length) return out;

  const rows = await prisma.brokerEvent.findMany({
    where: { tradingAccount: { in: unique } },
    orderBy: { occurredAt: "asc" },
  });

  for (const acc of unique) {
    const mine = rows.filter((r) => r.tradingAccount === acc);
    const sum = (type: string) =>
      mine.filter((r) => r.type === type).reduce((n, r) => n + (r.amountUSD ?? 0), 0);
    const deposit = sum(T.DEPOSIT);
    const withdrawal = sum(T.WITHDRAWAL);
    out.set(acc, {
      signupAt: mine.find((r) => r.type === T.SIGNUP)?.occurredAt ?? null,
      depositTotalUSD: deposit,
      withdrawalTotalUSD: withdrawal,
      netUSD: deposit - withdrawal,
      accountName: mine.map((r) => r.accountName).find(Boolean) ?? null,
      accountEmail: mine.map((r) => r.accountEmail).find(Boolean) ?? null,
      events: mine.map((r) => ({
        id: r.id,
        type: r.type,
        amountUSD: r.amountUSD,
        occurredAt: r.occurredAt,
        source: r.source,
      })),
    });
  }
  return out;
}

export type EvidenceCheck = {
  /** ผ่านครบทุกข้อตามหลักฐานที่มี — ยังต้องให้คนกดอนุมัติเอง ไม่อนุมัติอัตโนมัติ */
  ok: boolean;
  lines: Array<{ label: string; ok: boolean | null; detail: string }>;
};

/**
 * เทียบหลักฐานกับเงื่อนไข — ok: true ผ่าน / false ไม่ผ่าน / null ยังไม่มีข้อมูล
 * ตั้งใจไม่อนุมัติอัตโนมัติ: อีเมลปลอมแปลงง่ายกว่าหลังบ้านโบรก คนต้องเป็นคนตัดสิน
 */
export function checkEvidence(
  ev: AccountEvidence | undefined,
  opts: { minDepositUSD: number; customerName: string | null; customerEmail: string | null }
): EvidenceCheck {
  if (!ev || !ev.events.length) {
    return {
      ok: false,
      lines: [{ label: "ข้อมูลจากโบรก", ok: null, detail: "ยังไม่มี — ต้องเปิดหลังบ้านโบรกเช็กเอง" }],
    };
  }

  const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const nameMatch = ev.accountName && opts.customerName ? norm(ev.accountName) === norm(opts.customerName) : null;
  const emailMatch =
    ev.accountEmail && opts.customerEmail ? norm(ev.accountEmail) === norm(opts.customerEmail) : null;

  const lines: EvidenceCheck["lines"] = [
    {
      label: "สมัครใต้ลิงก์ QVX",
      ok: ev.signupAt ? true : null,
      detail: ev.signupAt ? `พบการสมัคร ${ev.signupAt.toLocaleDateString("th-TH")}` : "ยังไม่ได้รับอีเมลแจ้งการสมัคร",
    },
    {
      label: `ยอดคงเหลือ ≥ $${opts.minDepositUSD}`,
      ok: ev.events.some((e) => e.type === "DEPOSIT") ? ev.netUSD >= opts.minDepositUSD : null,
      detail: ev.events.some((e) => e.type === "DEPOSIT")
        ? `ฝาก $${ev.depositTotalUSD.toLocaleString()} ถอน $${ev.withdrawalTotalUSD.toLocaleString()} เหลือ $${ev.netUSD.toLocaleString()}`
        : "ยังไม่ได้รับอีเมลแจ้งการฝาก",
    },
    {
      label: "ชื่อตรงกับบัญชีโบรก",
      ok: nameMatch,
      detail: ev.accountName ? `โบรก: ${ev.accountName}` : "อีเมลไม่ได้บอกชื่อเจ้าของบัญชี",
    },
    {
      label: "อีเมลตรงกับบัญชีโบรก",
      ok: emailMatch,
      detail: ev.accountEmail ? `โบรก: ${ev.accountEmail}` : "อีเมลไม่ได้บอกอีเมลเจ้าของบัญชี",
    },
  ];

  return { ok: lines.every((l) => l.ok === true), lines };
}
