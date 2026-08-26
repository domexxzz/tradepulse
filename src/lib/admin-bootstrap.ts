import { prisma } from "@/lib/prisma";

/**
 * เปิดสิทธิ์แอดมินคนแรกบน production
 *
 * ปัญหาเดิม: คนสมัครใหม่ได้ role USER เสมอ และ prisma/seed.mjs (ที่เลื่อนขั้นให้)
 * ไม่ได้รันตอน deploy บน Vercel จึงไม่มีทางได้สิทธิ์แอดมินโดยไม่แก้ฐานข้อมูลตรง ๆ
 *
 * ทางแก้: ตั้ง ADMIN_EMAILS บน Vercel แล้วอีเมลในลิสต์จะถูกเลื่อนขั้นให้ตอนล็อกอิน
 * ค่านี้อ่านได้เฉพาะฝั่งเซิร์ฟเวอร์ และแก้ได้เฉพาะคนที่เข้า Vercel ได้
 *
 * เลื่อนขั้นอย่างเดียว ไม่ลดขั้น — เอาอีเมลออกจากลิสต์แล้วสิทธิ์ยังอยู่
 * ถ้าต้องการถอนสิทธิ์ ให้แก้ role ในฐานข้อมูลหรือหน้าแอดมิน
 */
/**
 * อ่าน env ตอนเรียกใช้ ไม่ใช่ตอนโหลดโมดูล
 * ค่าที่อ่านระดับบนสุดของไฟล์มีโอกาสถูกฝังตั้งแต่ตอน build ทำให้แก้ env
 * แล้วไม่มีผลจนกว่าจะ build ใหม่ทั้งก้อน
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email?: string | null): boolean {
  if (!email) return false;
  const list = adminEmails();
  return list.length > 0 && list.includes(email.trim().toLowerCase());
}

/**
 * คืน role ที่ถูกต้องของผู้ใช้ และเลื่อนขั้นในฐานข้อมูลให้ถาวรถ้าเข้าเงื่อนไข
 * ล้มเหลวไม่ทำให้ล็อกอินพัง — คืน role เดิมไปก่อน
 */
export async function resolveRole(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!user) return "USER";

  if (user.role !== "ADMIN" && isBootstrapAdmin(user.email)) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
      return "ADMIN";
    } catch {
      return user.role;
    }
  }

  return user.role;
}
