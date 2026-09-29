import { prisma } from "@/lib/prisma";
import { BROKER_APPLICATION_STATUS as S } from "@/config/status";
import { BROKERS } from "@/config/brokers";
import { evidenceFor, checkEvidence } from "@/lib/broker-events";
import { approveBrokerApplication } from "@/lib/broker";
import { sendAdminAlert } from "@/lib/telegram";

/**
 * อนุมัติคำขอรับสิทธิ์ผ่านโบรกเองเมื่อหลักฐานจากอีเมลโบรกครบ
 *
 * ทำไมเชื่อถือได้: อีเมลมาจาก Wisdom โดยตรงเข้ากล่องของเรา ไม่ได้ให้ลูกค้าส่งต่อมา
 * จึงเป็นข้อมูลจากต้นทางจริง ต่างจากสลิปโอนเงินที่ลูกค้าอัปรูปเข้ามาเอง
 *
 * เงื่อนไขคือ "ทุกข้อต้องผ่านจริง" จาก checkEvidence ซึ่งหมายความว่า
 *   · มีอีเมลยืนยันว่าเปิดบัญชีใต้ลิงก์ QVX
 *   · ยอดคงเหลือหลังหักถอนถึงเกณฑ์ของโบรกนั้น
 *   · ชื่อเจ้าของบัญชีที่โบรกแจ้งตรงกับชื่อในระบบเรา
 *
 * ข้อที่ระบบ "ตัดสินไม่ได้" (เช่นโบรกเขียนชื่อคนละภาษากับที่ลูกค้ากรอก) นับเป็นไม่ผ่าน
 * โดยตั้งใจ — ปล่อยให้คนดูดีกว่าเปิดสิทธิ์ให้ผิดคน เพราะเลขบัญชีเทรดเป็นสิ่งที่
 * ใครก็พิมพ์เข้ามาได้ ถ้าไม่เทียบชื่อเลย คนที่รู้เลขบัญชีคนอื่นจะยึดสิทธิ์ไปได้
 *
 * ไม่มีผู้อนุมัติเป็นคน จึงไม่บันทึก reviewedById — ดูออกภายหลังว่าใบไหนระบบอนุมัติเอง
 */

/** เปิดสวิตช์ด้วย BROKER_AUTO_APPROVE=true */
export const brokerAutoApprove = process.env.BROKER_AUTO_APPROVE === "true";

export interface BrokerAutoResult {
  checked: number;
  approved: number;
  results: Array<{
    id: string;
    member: string;
    account: string;
    approved: boolean;
    reason?: string;
  }>;
}

export async function autoApproveBrokerApplications(): Promise<BrokerAutoResult> {
  const empty: BrokerAutoResult = { checked: 0, approved: 0, results: [] };
  if (!brokerAutoApprove) return empty;

  const pending = await prisma.brokerApplication.findMany({
    where: { status: S.PENDING },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      broker: true,
      tradingAccount: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (pending.length === 0) return empty;

  // ดึงหลักฐานทีเดียวทุกบัญชี ไม่ยิงฐานข้อมูลทีละใบ
  const evidence = await evidenceFor(pending.map((a) => a.tradingAccount));

  const results: BrokerAutoResult["results"] = [];
  for (const app of pending) {
    const member = app.user.name ?? app.user.email ?? app.id;
    const broker = BROKERS[app.broker];
    if (!broker) {
      results.push({ id: app.id, member, account: app.tradingAccount, approved: false, reason: "ไม่รู้จักโบรกนี้" });
      continue;
    }

    const check = checkEvidence(evidence.get(app.tradingAccount), {
      minDepositUSD: broker.qvxMinDepositUSD,
      customerName: app.user.name,
      customerEmail: app.user.email,
    });

    if (!check.ok) {
      // บอกเหตุผลจากข้อที่ยังไม่ผ่าน เพื่อให้ตามต่อได้โดยไม่ต้องเปิดหน้าเว็บ
      const blocking = check.lines.filter((l) => l.ok !== true).map((l) => `${l.label}: ${l.detail}`);
      results.push({ id: app.id, member, account: app.tradingAccount, approved: false, reason: blocking.join(" · ") });
      continue;
    }

    const done = await approveBrokerApplication({ applicationId: app.id, adminId: "" });
    results.push({
      id: app.id,
      member,
      account: app.tradingAccount,
      approved: done.ok,
      reason: done.ok ? undefined : done.error,
    });

    if (done.ok) {
      await sendAdminAlert(
        [
          "✅ อนุมัติคำขอผ่านโบรกอัตโนมัติแล้ว",
          `สมาชิก: ${member}`,
          `บัญชีเทรด: ${app.tradingAccount} (${broker.name})`,
          "",
          "หลักฐานจากอีเมลโบรกผ่านครบทุกข้อ:",
          ...check.lines.map((l) => `· ${l.label} — ${l.detail}`),
          "",
          "เปิดสิทธิ์ให้แล้วโดยไม่ต้องรอใครกด",
        ].join("\n"),
      ).catch((e) => console.error("broker auto alert failed:", e));
    }
  }

  return { checked: pending.length, approved: results.filter((r) => r.approved).length, results };
}
