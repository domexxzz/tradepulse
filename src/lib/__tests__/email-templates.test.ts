import { describe, it, expect } from "vitest";
import { newsletterEmail, receiptEmail } from "@/lib/email-templates";

const URL = "https://example.test/unsubscribe?token=abc123";

describe("newsletterEmail", () => {
  it("ใส่ลิงก์ยกเลิกทั้งใน HTML และข้อความธรรมดา", () => {
    const mail = newsletterEmail({ subject: "อัปเดตประจำเดือน", body: "สวัสดีครับ", unsubscribeUrl: URL });
    expect(mail.html).toContain(URL);
    expect(mail.text).toContain(URL);
    expect(mail.subject).toBe("อัปเดตประจำเดือน");
  });

  it("ตัด HTML ที่แอดมินพิมพ์มาไม่ให้ทำงาน", () => {
    const mail = newsletterEmail({
      body: '<script>alert(1)</script> และ <img src=x onerror=y>',
      subject: "ทดสอบ",
      unsubscribeUrl: URL,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("เว้นบรรทัดว่างแล้วขึ้นย่อหน้าใหม่", () => {
    const mail = newsletterEmail({ body: "ย่อหน้าแรก\n\nย่อหน้าสอง", subject: "ทดสอบ", unsubscribeUrl: URL });
    const paragraphs = mail.html.match(/<p style="margin:0 0 14px;">/g) ?? [];
    expect(paragraphs).toHaveLength(2);
  });

  it("บรรทัดเดียวที่ขึ้นบรรทัดใหม่ กลายเป็น <br> ไม่ใช่ย่อหน้าใหม่", () => {
    const mail = newsletterEmail({ body: "บรรทัดแรก\nบรรทัดสอง", subject: "ทดสอบ", unsubscribeUrl: URL });
    expect(mail.html).toContain("<br>");
    expect(mail.html.match(/<p style="margin:0 0 14px;">/g) ?? []).toHaveLength(1);
  });
});

describe("receiptEmail — ได้สิทธิ์โดยไม่ได้จ่ายเงิน", () => {
  const base = { name: "ทดสอบ", planName: "รายเดือน", until: new Date("2026-10-26"), orderId: "broker_abc12345" };

  it("ยอด 0 บาท (ผ่านโบรก / แถมให้) ไม่ใช่ใบเสร็จ — ห้ามเขียนว่ายืนยันการชำระเงิน", () => {
    const m = receiptEmail({ ...base, amountTHB: 0 });
    expect(m.subject).not.toContain("ชำระเงิน");
    expect(m.subject).toContain("เปิดสิทธิ์ใช้งานแล้ว");
    expect(m.html).not.toContain("ยอดชำระ");
    expect(m.text).not.toContain("ยอดชำระ");
  });

  it("จ่ายเงินจริงยังเป็นใบเสร็จเหมือนเดิม", () => {
    const m = receiptEmail({ ...base, amountTHB: 990 });
    expect(m.subject).toContain("ยืนยันการชำระเงิน");
    expect(m.html).toContain("ยอดชำระ");
  });
});
