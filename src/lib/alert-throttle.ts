import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";

/**
 * ด่านสุดท้ายกันแจ้งเตือนซ้ำถล่มกลุ่มแอดมิน
 *
 * บทเรียนที่ทำให้ต้องมีตัวนี้: เราใส่ "ตัวกันเตือนซ้ำ" ไว้ในแต่ละเส้นทางมาสองรอบ
 * แล้วทั้งสองรอบตัวกันเองก็พัง — รอบแรกเพราะเทียบเวลาจากคอลัมน์ที่ไม่ขยับ
 * รอบสองเพราะโค้ดอีกบรรทัดล้างค่าที่ตัวกันใช้เทียบทิ้งก่อนเสมอ ผลคือแอดมินได้
 * ข้อความเดิมทุก 15 นาทีติดกันสองวันจนเลิกอ่านกลุ่ม ซึ่งอันตรายกว่าไม่มีแจ้งเตือน
 * เพราะเรื่องจริงที่สำคัญจะจมหายไปในกองข้อความซ้ำ
 *
 * ตัวนี้จึงไม่สนว่าบั๊กอยู่ตรงไหน: ตัดสินจากสิ่งที่กำลังจะส่งออกจริง ๆ เท่านั้น
 *   · คีย์เดิม + เนื้อเดิม + ยังไม่พ้นหน้าต่างเวลา  → ไม่ส่ง แค่นับไว้
 *   · เนื้อเปลี่ยน                                  → ส่งทันที (เรื่องเปลี่ยนแล้ว)
 *   · พ้นหน้าต่างเวลา                               → ส่งซ้ำได้ พร้อมบอกว่ากลั้นไปกี่ครั้ง
 *
 * ตั้งใจให้ "เนื้อเปลี่ยน = ส่งทันที" เพื่อไม่ให้ตัวกันกลายเป็นตัวกลบเรื่องใหม่
 */

/** นานเท่าไหร่ถึงยอมให้ข้อความเดิมออกซ้ำได้ */
const DEFAULT_WINDOW_MINUTES = 6 * 60;

export interface ThrottledAlertResult {
  sent: boolean;
  /** กลั้นไว้กี่ครั้งแล้วนับจากที่ส่งรอบล่าสุด (รวมครั้งนี้ถ้าถูกกลั้น) */
  suppressed: number;
  reason?: string;
}

function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * ส่งแจ้งเตือนแอดมินโดยกันข้อความเดิมไม่ให้ออกซ้ำในหน้าต่างเวลาที่กำหนด
 *
 * @param key    ชื่อเรื่อง เรื่องเดียวกันต้องส่งคีย์เดิมเสมอ เช่น `tv-grant-fail:${grantId}`
 * @param text   เนื้อข้อความเต็มที่จะส่ง
 */
export async function sendAdminAlertThrottled(
  key: string,
  text: string,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
): Promise<ThrottledAlertResult> {
  const hash = fingerprint(text);
  const now = new Date();

  let previous: { hash: string; lastSentAt: Date; suppressed: number } | null = null;
  try {
    previous = await prisma.alertThrottle.findUnique({
      where: { key },
      select: { hash: true, lastSentAt: true, suppressed: true },
    });
  } catch (e) {
    // อ่านตารางกันซ้ำไม่ได้ (เช่นยังไม่ได้ migrate) — ยอมส่งออกไปดีกว่าเงียบ
    // แจ้งเตือนที่ซ้ำยังแก้ได้ทีหลัง แต่แจ้งเตือนที่หายไปคือเรื่องที่ไม่มีใครรู้
    console.error("alert-throttle: อ่านไม่ได้ ส่งออกไปก่อน:", e);
    const res = await sendAdminAlert(text);
    return { sent: res.sent, suppressed: 0, reason: res.reason };
  }

  const sameContent = previous?.hash === hash;
  const withinWindow =
    previous != null && now.getTime() - previous.lastSentAt.getTime() < windowMinutes * 60_000;

  if (sameContent && withinWindow) {
    const suppressed = (previous?.suppressed ?? 0) + 1;
    await prisma.alertThrottle
      .update({ where: { key }, data: { suppressed } })
      .catch(() => {});
    return { sent: false, suppressed, reason: "ข้อความเดิม ยังไม่พ้นหน้าต่างเวลา" };
  }

  /**
   * บอกไปด้วยว่าระหว่างที่เงียบไปนั้นเรื่องเดิมเกิดซ้ำกี่ครั้ง
   * ตัวเลขนี้คือสิ่งที่บอกว่า "มีอะไรวนอยู่" ซึ่งสำคัญกว่าตัวข้อความเอง
   */
  const silenced = sameContent ? (previous?.suppressed ?? 0) : 0;
  const body =
    silenced > 0 ? `${text}\n\n(เรื่องเดิมเกิดซ้ำอีก ${silenced} ครั้งระหว่างนี้ ไม่ได้ส่งซ้ำให้)` : text;

  const res = await sendAdminAlert(body);

  // ส่งไม่ออกก็ไม่ต้องจด จะได้ลองใหม่รอบหน้า ไม่งั้นเรื่องนี้จะเงียบไปทั้งหน้าต่างเวลา
  if (res.sent) {
    await prisma.alertThrottle
      .upsert({
        where: { key },
        create: { key, hash, lastSentAt: now, suppressed: 0 },
        update: { hash, lastSentAt: now, suppressed: 0 },
      })
      .catch((e) => console.error("alert-throttle: จดไม่ได้:", e));
  }

  return { sent: res.sent, suppressed: 0, reason: res.reason };
}
