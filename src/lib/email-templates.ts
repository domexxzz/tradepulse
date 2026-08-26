/**
 * เทมเพลตอีเมลทั้งหมดของระบบ (ภาษาไทย)
 *
 * เขียนเป็น HTML แบบ inline style ล้วน — โปรแกรมอ่านอีเมลส่วนใหญ่ตัด <style> ทิ้ง
 * และไม่รองรับ flex/grid จึงใช้ตารางกับ inline style เท่านั้น
 */
import { site } from "@/config/site";
import { formatTHB } from "@/lib/utils";
import { formatThaiDate } from "@/lib/date";

const BG = "#08100b";
const SURFACE = "#101a12";
const TEXT = "#f3f7f1";
const MUTED = "#91a095";
const BRAND = "#65e62c";
const BORDER = "#1e2b22";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** กรอบอีเมลมาตรฐาน (หัวแบรนด์ + เนื้อหา + ท้ายอีเมล) */
function shell(bodyHtml: string, preview: string): string {
  return `<!doctype html>
<html lang="th">
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
          <span style="font-size:18px;font-weight:700;color:${TEXT};letter-spacing:-0.01em;">${site.name}</span>
          <span style="font-size:12px;color:${MUTED};margin-left:8px;">${site.tagline}</span>
        </td></tr>
        <tr><td style="padding:28px;color:${TEXT};font-size:15px;line-height:1.7;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:1.6;">
          อีเมลนี้ส่งอัตโนมัติจากระบบสมาชิก ${site.name}<br>
          ${site.name} จำหน่ายเครื่องมือช่วยวิเคราะห์บน TradingView เท่านั้น ไม่รับบริหารเงินทุนและไม่รับประกันผลตอบแทน การเทรดมีความเสี่ยง<br>
          <a href="${site.url}" style="color:${MUTED};">${site.url.replace(/^https?:\/\//, "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:999px;background:${BRAND};">
    <a href="${href}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:600;color:#08100b;text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr></table>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:${MUTED};font-size:14px;">${label}</td>
    <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:${TEXT};">${value}</td>
  </tr>`;
}

const hi = (name?: string | null) => `สวัสดีครับ ${name ?? "สมาชิก"}`;

/** ใบเสร็จหลังแอดมินอนุมัติสลิป */
export function receiptEmail(input: {
  name?: string | null;
  planName: string;
  amountTHB: number;
  until: Date;
  orderId: string;
}): EmailContent {
  const until = formatThaiDate(input.until);
  return {
    subject: `ยืนยันการชำระเงิน · ${input.planName} — ${site.name}`,
    html: shell(
      `<p style="margin:0 0 12px;">${hi(input.name)}</p>
       <p style="margin:0 0 20px;">ยืนยันการชำระเงินเรียบร้อยแล้ว เปิดสิทธิ์ใช้งานให้คุณแล้วครับ</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:8px 0;">
         ${row("แพ็กเกจ", input.planName)}
         ${row("ยอดชำระ", formatTHB(input.amountTHB))}
         ${row("ใช้งานได้ถึง", until)}
         ${row("เลขที่ออเดอร์", input.orderId.slice(-8).toUpperCase())}
       </table>
       <p style="margin:20px 0 0;">ขั้นตอนต่อไป — กรอก TradingView username ในหน้าบัญชี เพื่อให้ทีมงานเพิ่มสิทธิ์อินดิเคเตอร์ให้</p>
       ${button(`${site.url}/account/tradingview`, "กรอก TradingView username")}`,
      `ยืนยันการชำระเงิน ${input.planName} ใช้งานได้ถึง ${until}`
    ),
    text: `${hi(input.name)}\n\nยืนยันการชำระเงินเรียบร้อยแล้ว\nแพ็กเกจ: ${input.planName}\nยอดชำระ: ${formatTHB(input.amountTHB)}\nใช้งานได้ถึง: ${until}\n\nกรอก TradingView username ที่ ${site.url}/account/tradingview`,
  };
}

/**
 * แจ้งลูกค้าว่าเพิ่มสิทธิ์อินดิเคเตอร์บน TradingView ให้แล้ว
 * แนบลิงก์เชิญกลุ่ม Telegram มาด้วยถ้ามี (ลิงก์ส่วนตัว ใช้ได้ครั้งเดียว)
 */
export function accessGrantedEmail(input: {
  name?: string | null;
  tvUsername: string;
  until?: Date | null;
  telegramInviteUrl?: string | null;
}): EmailContent {
  const until = input.until ? formatThaiDate(input.until) : null;
  const tg = input.telegramInviteUrl
    ? `<p style="margin:20px 0 0;">เข้ากลุ่มสัญญาณ Telegram ได้เลย — ลิงก์นี้เป็นลิงก์ส่วนตัวของคุณ ใช้ได้ครั้งเดียว ห้ามส่งต่อ</p>
       ${button(input.telegramInviteUrl, "เข้ากลุ่ม Telegram")}`
    : `<p style="margin:20px 0 0;">ลิงก์เข้ากลุ่ม Telegram ดูได้ในหน้าบัญชีของคุณ</p>
       ${button(`${site.url}/account`, "ไปที่หน้าบัญชี")}`;

  return {
    subject: `เพิ่มอินดิเคเตอร์ให้แล้ว · ${input.tvUsername} — ${site.name}`,
    html: shell(
      `<p style="margin:0 0 12px;">${hi(input.name)}</p>
       <p style="margin:0 0 20px;">เพิ่มสิทธิ์อินดิเคเตอร์ให้บัญชี TradingView ของคุณเรียบร้อยแล้ว</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:8px 0;">
         ${row("TradingView username", input.tvUsername)}
         ${until ? row("ใช้งานได้ถึง", until) : ""}
       </table>
       <p style="margin:20px 0 0;">เปิด TradingView แล้วดูที่ Indicators &rarr; Invite-only scripts จะเห็นอินดิเคเตอร์ของเราอยู่ในรายการ ถ้ายังไม่ขึ้นให้ล็อกเอาต์แล้วเข้าใหม่อีกครั้ง</p>
       ${tg}`,
      `เพิ่มอินดิเคเตอร์ให้บัญชี ${input.tvUsername} แล้ว`
    ),
    text: `${hi(input.name)}

เพิ่มสิทธิ์อินดิเคเตอร์ให้บัญชี TradingView ของคุณแล้ว
TradingView username: ${input.tvUsername}${until ? `
ใช้งานได้ถึง: ${until}` : ""}

เปิด TradingView -> Indicators -> Invite-only scripts
${input.telegramInviteUrl ? `
เข้ากลุ่ม Telegram (ลิงก์ส่วนตัว ใช้ได้ครั้งเดียว): ${input.telegramInviteUrl}` : `
ลิงก์กลุ่ม Telegram ดูได้ที่ ${site.url}/account`}`,
  };
}

/** เตือนก่อนหมดอายุ */
export function expiringSoonEmail(input: {
  name?: string | null;
  planName: string;
  until: Date;
  daysLeft: number;
}): EmailContent {
  const until = formatThaiDate(input.until);
  return {
    subject: `แพ็กเกจของคุณเหลืออีก ${input.daysLeft} วัน — ${site.name}`,
    html: shell(
      `<p style="margin:0 0 12px;">${hi(input.name)}</p>
       <p style="margin:0 0 20px;">แพ็กเกจ <b>${input.planName}</b> ของคุณจะหมดอายุใน <b style="color:${BRAND};">${input.daysLeft} วัน</b> (${until})</p>
       <p style="margin:0 0 8px;">เมื่อหมดอายุ ระบบจะปิดสิทธิ์อินดิเคเตอร์บน TradingView ยศในเซิร์ฟเวอร์ Discord และสิทธิ์กลุ่มสัญญาณ Telegram โดยอัตโนมัติ</p>
       <p style="margin:0;">ต่ออายุก่อนหมดวัน วันที่เหลือจะถูกทบให้ ไม่หายครับ</p>
       ${button(`${site.url}/account/subscription`, "ต่ออายุแพ็กเกจ")}`,
      `แพ็กเกจหมดอายุใน ${input.daysLeft} วัน (${until})`
    ),
    text: `${hi(input.name)}\n\nแพ็กเกจ ${input.planName} จะหมดอายุใน ${input.daysLeft} วัน (${until})\nต่ออายุที่ ${site.url}/account/subscription`,
  };
}

/** แจ้งเมื่อหมดอายุและระบบปิดสิทธิ์แล้ว */
export function expiredEmail(input: { name?: string | null; planName: string }): EmailContent {
  return {
    subject: `แพ็กเกจหมดอายุแล้ว — ${site.name}`,
    html: shell(
      `<p style="margin:0 0 12px;">${hi(input.name)}</p>
       <p style="margin:0 0 20px;">แพ็กเกจ <b>${input.planName}</b> หมดอายุแล้ว ระบบได้ปิดสิทธิ์การใช้งานเรียบร้อย</p>
       <p style="margin:0;">กลับมาต่ออายุได้ทุกเมื่อ ข้อมูลบัญชีและ TradingView username ของคุณยังอยู่ครบ ไม่ต้องกรอกใหม่</p>
       ${button(`${site.url}/account/subscription`, "ต่ออายุแพ็กเกจ")}`,
      "แพ็กเกจหมดอายุแล้ว ต่ออายุได้ทุกเมื่อ"
    ),
    text: `${hi(input.name)}\n\nแพ็กเกจ ${input.planName} หมดอายุแล้ว\nต่ออายุที่ ${site.url}/account/subscription`,
  };
}

/** ลิงก์ตั้งรหัสผ่านใหม่ */
export function passwordResetEmail(input: { name?: string | null; url: string; minutes: number }): EmailContent {
  return {
    subject: `ตั้งรหัสผ่านใหม่ — ${site.name}`,
    html: shell(
      `<p style="margin:0 0 12px;">${hi(input.name)}</p>
       <p style="margin:0 0 20px;">มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
       ${button(input.url, "ตั้งรหัสผ่านใหม่")}
       <p style="margin:0 0 8px;color:${MUTED};font-size:13px;">ลิงก์นี้ใช้ได้ ${input.minutes} นาที และใช้ได้ครั้งเดียว</p>
       <p style="margin:0;color:${MUTED};font-size:13px;">ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไรครับ รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>`,
      "ลิงก์ตั้งรหัสผ่านใหม่"
    ),
    text: `${hi(input.name)}\n\nตั้งรหัสผ่านใหม่ที่ลิงก์นี้ (ใช้ได้ ${input.minutes} นาที):\n${input.url}\n\nถ้าไม่ได้เป็นคนขอ ไม่ต้องทำอะไรครับ`,
  };
}

/**
 * อีเมลข่าวสารถึงผู้ที่สมัครรับข่าว
 * ต้องมีลิงก์ยกเลิกเสมอ — เป็นข้อกำหนดของ PDPA และทำให้อีเมลไม่ตกถังสแปม
 */
export function newsletterEmail(input: {
  subject: string;
  /** เนื้อหาแบบข้อความธรรมดา ขึ้นย่อหน้าใหม่ด้วยการเว้นบรรทัด */
  body: string;
  unsubscribeUrl: string;
}): EmailContent {
  const paragraphs = input.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = shell(
    `${paragraphs}
     ${button(site.url, "เปิดเว็บไซต์")}
     <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:1.6;">
       คุณได้รับอีเมลนี้เพราะเคยสมัครรับข่าวสารจาก ${site.name}<br>
       <a href="${input.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">ยกเลิกรับข่าวสาร</a>
     </p>`,
    input.subject
  );

  const text = `${input.body}

---
ยกเลิกรับข่าวสาร: ${input.unsubscribeUrl}`;
  return { subject: input.subject, html, text };
}

/** กัน HTML แปลกปลอมจากข้อความที่แอดมินพิมพ์ */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
