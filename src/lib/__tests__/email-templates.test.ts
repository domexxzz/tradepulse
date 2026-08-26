import { describe, it, expect } from "vitest";
import { newsletterEmail } from "@/lib/email-templates";

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
