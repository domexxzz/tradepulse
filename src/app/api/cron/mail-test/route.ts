import { NextResponse } from "next/server";
import { sendEmail, emailConfigStatus } from "@/lib/email";
import { site } from "@/config/site";
import { telegramInviteEmail } from "@/lib/email-templates";
import { checkGroupPermissions, createMemberInviteLink, telegramGroupManaged } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * ยิงอีเมลทดสอบหาแอดมิน — คู่ของ /api/cron/test-alert ที่ทดสอบฝั่ง Telegram
 *
 * มีไว้เพราะอีเมลเป็นระบบที่ล้มแบบเงียบที่สุดในบ้านเรา — เว็บทำงานปกติทุกอย่าง
 * ลูกค้าแค่ไม่ได้รับของ แล้วไปถามแอดมินทีละคน กว่าจะรู้ต้นเหตุก็ผ่านไปเป็นเดือน
 * (29 ก.ย. 69 เจอว่า RESEND_API_KEY เป็นค่าว่างมาตลอด และโดเมนยังไม่ verify
 * อีเมลทุกฉบับถูกข้ามไปเงียบ ๆ โดยไม่มีอะไรฟ้อง)
 *
 * ส่งหาที่อยู่ใน ADMIN_EMAILS เท่านั้น ไม่รับปลายทางจากพารามิเตอร์
 * ถ้ารับปลายทางได้ ใครที่หลุด CRON_SECRET ไปจะใช้เว็บเราส่งอีเมลหาใครก็ได้
 *
 * ตอบกลับเป็นผลจริงจากผู้ให้บริการ (เช่น "resend 403" = โดเมนยังไม่ verify)
 * จะได้รู้สาเหตุทันทีโดยไม่ต้องไล่อ่าน log
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = emailConfigStatus();
  const to = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  /**
   * ค่าตัวอย่างที่ลืมแก้ อันตรายกว่าค่าว่าง
   *
   * ค่าว่างมีข้อความบอกอยู่แล้วว่า "ยังไม่ได้ตั้ง" แต่ค่าตัวอย่างอย่าง boss@example.com
   * ดูเหมือนตั้งค่าเรียบร้อย ระบบจะพยายามส่งแล้วได้ resend 422 กลับมา
   * ซึ่งอ่านแล้วเหมือนปัญหาของผู้ให้บริการอีเมล ไม่ใช่ปัญหาของค่าที่เราตั้งเอง
   * (เจอจริง 2 พ.ย. 69 — ADMIN_EMAILS บน production เป็น boss@example.com)
   *
   * ADMIN_EMAILS ยังใช้เลื่อนขั้นเป็นแอดมินตอนล็อกอินด้วย ตั้งผิดไว้แปลว่า
   * ตั้งแอดมินคนใหม่ไม่ได้เลยจนกว่าจะแก้ — เงียบอีกจุดที่ไม่มีอะไรฟ้อง
   */
  const placeholders = to.filter((a) => /@(example\.(com|org|net)|test|localhost)$/i.test(a));
  if (placeholders.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          `ADMIN_EMAILS ยังเป็นค่าตัวอย่าง (${placeholders.join(", ")}) — ไม่ใช่อีเมลจริง ` +
          `แก้เป็นอีเมลของเจ้าของก่อน ไม่งั้นแจ้งเตือนทางอีเมลไม่ถึงใคร และตั้งแอดมินคนใหม่ไม่ได้`,
        config,
        adminEmails: to,
      },
      { status: 400 },
    );
  }

  if (to.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "ยังไม่ได้ตั้ง ADMIN_EMAILS — ไม่รู้จะส่งหาใคร", config },
      { status: 400 },
    );
  }

  const stamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  /**
   * ?invite=1 — ส่ง "อีเมลฉบับจริงที่ลูกค้าได้" พร้อมลิงก์เชิญจริง
   *
   * ต่างจากอีเมลทดสอบธรรมดาตรงที่พิสูจน์ได้ถึงปลายทาง: เปิดลิงก์แล้วเห็นชื่อห้อง
   * ว่าพาไปห้องถูกไหม ซึ่งเป็นสิ่งที่ตรวจจากฝั่งเซิร์ฟเวอร์อย่างเดียวไม่ได้
   * (ลิงก์เชิญเป็นสตริงทึบ ดูไม่ออกว่าของกลุ่มไหนจนกว่าจะเปิด)
   */
  const wantInvite = new URL(req.url).searchParams.get("invite") === "1";
  let invite: Record<string, unknown> | undefined;

  if (wantInvite) {
    if (!telegramGroupManaged) {
      invite = { ok: false, reason: "ยังไม่ได้เปิดระบบกลุ่มอัตโนมัติ" };
    } else {
      try {
        const perm = await checkGroupPermissions();
        const link = await createMemberInviteLink(`mailtest-${Date.now()}`);
        const mail = telegramInviteEmail({
          name: "แอดมิน",
          inviteUrl: link,
          until: null,
        });
        const sent = [];
        for (const address of to) {
          const res = await sendEmail({ to: address, ...mail });
          sent.push({ to: address, ok: res.ok, error: res.error });
        }
        invite = { ok: sent.every((r) => r.ok), group: perm.title, sent };
      } catch (e) {
        invite = { ok: false, reason: e instanceof Error ? e.message : "unknown" };
      }
    }
  }

  const results = [];
  for (const address of to) {
    const res = await sendEmail({
      to: address,
      subject: `ทดสอบระบบอีเมล — ${site.name}`,
      html: `<p>ถ้าคุณเห็นอีเมลฉบับนี้ แปลว่าระบบส่งอีเมลทำงานแล้ว</p>
             <p>ใบเสร็จ ลิงก์เข้ากลุ่ม เตือนก่อนหมดอายุ และลืมรหัสผ่าน จะถึงมือลูกค้าตามปกติ</p>
             <p>เวลา: ${stamp}</p>`,
      text: `ถ้าคุณเห็นอีเมลฉบับนี้ แปลว่าระบบส่งอีเมลทำงานแล้ว\nเวลา: ${stamp}`,
    });
    results.push({ to: address, ok: res.ok, skipped: res.skipped, error: res.error });
  }

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, config, results, ...(invite ? { invite } : {}) }, { status: ok ? 200 : 502 });
}

export const GET = run;
export const POST = run;
