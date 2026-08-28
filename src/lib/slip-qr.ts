import jsQR from "jsqr";
// ตัว sharp ประกาศชนิดไว้ใน namespace ที่ export = ต้องดึงชนิดแยกจากค่า
// เขียน sharp.Sharp ตรง ๆ ไม่ได้เพราะ default import ให้มาแค่ค่า ไม่ใช่ namespace
import sharp, { type Sharp } from "sharp";

/**
 * อ่าน QR ที่ธนาคารฝังไว้ในสลิป — ทำงานในเครื่องเรา ไม่ต้องพึ่งบริการภายนอก
 *
 * ทำไมต้องมี: สลิปซ้ำกันได้สองแบบ
 *   1. ส่งไฟล์รูปเดิม -> sha256 จับได้อยู่แล้ว
 *   2. ถ่ายรูปสลิปเดิมใหม่ / ครอปใหม่ / แคปหน้าจอใหม่ -> sha256 เปลี่ยน จับไม่ได้
 * QR ในสลิปเป็นของธนาคาร ผูกกับ "รายการโอน" ไม่ใช่ "ไฟล์รูป"
 * ถ่ายกี่ครั้ง ครอปยังไง ค่าใน QR ก็เท่าเดิม จึงกันแบบที่สองได้
 *
 * จุดสำคัญของการออกแบบ: เราไม่จำเป็นต้องเข้าใจความหมายข้างใน QR
 * ตัว payload ทั้งก้อนคือลายนิ้วมือของรายการโอนอยู่แล้ว — คนละรายการก็คนละค่า
 * จึงใช้เป็นกุญแจกันซ้ำได้ทันทีโดยไม่ต้องเดาสเปกของแต่ละธนาคาร
 * ส่วนการแกะเลขอ้างอิงออกมาโชว์เป็นของแถม พลาดก็ไม่กระทบการกันซ้ำ
 */

export interface SlipQrResult {
  found: boolean;
  /** ค่าดิบทั้งก้อนจาก QR — ใช้เป็นกุญแจกันซ้ำ */
  payload?: string;
  /** เลขอ้างอิงที่แกะได้ ใช้โชว์ให้แอดมินอ่าน (อาจไม่มี) */
  ref?: string;
  /** ผ่านชั้นไหนถึงอ่านได้ — ไว้ดูตอนมีสลิปที่อ่านไม่ออก */
  strategy?: string;
}

/** สลิปส่วนใหญ่เล็กกว่านี้ ถ้าใหญ่กว่าย่อลงก่อนเพื่อไม่ให้ decode ช้า */
const MAX_EDGE = 1600;
/** QR ในสลิปมักเล็กมาก ต้องขยายก่อนถึงจะอ่านออก */
const UPSCALE_TARGET = 1400;

type Attempt = { name: string; build: (img: Sharp) => Sharp };

/**
 * ไล่อ่านหลายชั้น จากถูกที่สุดไปแพงที่สุด เจอเมื่อไหร่หยุดทันที
 *
 * แต่ละชั้นแก้ปัญหาคนละอย่างที่เจอจริงกับสลิปจากมือถือ:
 *   native    - สลิปคมชัดขนาดปกติ (เคสส่วนใหญ่จบตรงนี้)
 *   upscale   - QR เล็กเกินกว่าจะจับ pattern ได้
 *   sharpen   - ภาพถ่ายจากหน้าจออีกที ขอบเบลอ
 *   threshold - สลิปพื้นเทาหรือภาพมืด ต้องดันให้เป็นขาวดำชัด
 *   bottom    - QR อยู่ท้ายสลิปเสมอ ตัดครึ่งล่างมาขยายจะได้ความละเอียดมากกว่าเดิม
 *   negate    - แคปจากโหมดมืดที่ QR กลับสี
 *
 * ห้ามใช้ grayscale() ในชั้นไหนก็ตาม: มันตรึงภาพไว้ที่ 1 channel แล้ว
 * toColourspace/ensureAlpha ที่ตามมาจะไม่มีผล ทำให้ตัวถอด QR ได้ข้อมูลผิดรูป
 * ทุกชั้นจึงทำงานบน RGB แล้วปล่อยให้ตัวถอด QR แปลงขาวดำเองซึ่งมันทำได้อยู่แล้ว
 */
const resized = (img: Sharp) => img.resize({ width: UPSCALE_TARGET, withoutEnlargement: false });

const ATTEMPTS: Attempt[] = [
  { name: "native", build: (img) => img },
  { name: "upscale", build: (img) => resized(img) },
  { name: "sharpen", build: (img) => resized(img).normalize().sharpen() },
  { name: "threshold", build: (img) => resized(img).threshold(140, { greyscale: false }) },
  { name: "bottom", build: (img) => resized(img).normalize().sharpen() },
  { name: "negate", build: (img) => resized(img).negate({ alpha: false }) },
];

async function decodeWith(buf: Buffer, attempt: Attempt, cropBottom: boolean): Promise<string | null> {
  let pipeline = sharp(buf, { failOn: "none" }).rotate();

  if (cropBottom) {
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    const h = meta.height ?? 0;
    const w = meta.width ?? 0;
    if (h > 200 && w > 0) {
      const top = Math.floor(h * 0.45);
      pipeline = pipeline.extract({ left: 0, top, width: w, height: h - top });
    }
  }

  // ต้องบังคับกลับเป็น sRGB ก่อน ensureAlpha เสมอ:
  // grayscale() เหลือ 1 channel พอเติม alpha ได้ 2 ช่อง แต่ตัวถอด QR ต้องการ RGBA ครบ 4
  // ถ้าข้ามขั้นนี้จะได้ error "Malformed data passed to binarizer"
  const { data, info } = await attempt
    .build(pipeline)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    { inversionAttempts: "attemptBoth" }
  );

  const text = code?.data?.trim();
  return text ? text : null;
}

/**
 * แกะเลขอ้างอิงจาก payload แบบ TLV (tag 2 หลัก + ความยาว 2 หลัก + ค่า) เพื่อโชว์ให้แอดมินอ่าน
 *
 * เป็น best effort ล้วน ๆ — คืน undefined ได้ ไม่กระทบการกันซ้ำ
 * (การกันซ้ำใช้ payload ทั้งก้อน ซึ่งถูกต้องเสมอโดยไม่ต้องรู้สเปกของธนาคาร)
 *
 * เงื่อนไขกันการเดา: ต้องแตกได้อย่างน้อย 2 ฟิลด์ และค่าที่เลือกต้องสั้นกว่า
 * payload อย่างมีนัย ถ้าทั้งก้อนแตกออกมาเป็นฟิลด์เดียวแปลว่าเราไม่ได้แกะอะไรเลย
 * เอาไปโชว์จะกลายเป็นการอ้างว่ารู้เลขอ้างอิงทั้งที่ไม่รู้
 */
function extractRef(payload: string): string | undefined {
  if (!/^[0-9A-Za-z]+$/.test(payload)) return undefined;

  const values: string[] = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const len = Number(payload.slice(i + 2, i + 4));
    if (!Number.isFinite(len) || len <= 0) break;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) break;
    values.push(value);
    i += 4 + len;
  }

  if (values.length < 2) return undefined;

  return values
    .filter((v) => v.length >= 10 && v.length <= payload.length * 0.75 && /^[0-9A-Za-z]+$/.test(v))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * อ่าน QR จากสลิป · ไม่โยน error ออกไป — อ่านไม่ได้ก็ตกไปใช้ sha256 เหมือนเดิม
 * (สลิปบางธนาคารไม่มี QR เลย จึงต้องถือว่าอ่านไม่ได้เป็นเรื่องปกติ)
 */
export async function readSlipQr(base64: string): Promise<SlipQrResult> {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { found: false };
  }
  if (!buf.length) return { found: false };

  // ย่อภาพใหญ่ลงก่อน ให้แต่ละชั้นทำงานบนขนาดที่คุมได้
  let normalized = buf;
  try {
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (edge > MAX_EDGE) {
      normalized = await sharp(buf, { failOn: "none" })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside" })
        .toBuffer();
    }
  } catch {
    // อ่าน metadata ไม่ได้ก็ลองใช้ไฟล์เดิมต่อไป
  }

  for (const attempt of ATTEMPTS) {
    try {
      const payload = await decodeWith(normalized, attempt, attempt.name === "bottom");
      if (payload) {
        return { found: true, payload, ref: extractRef(payload), strategy: attempt.name };
      }
    } catch (e) {
      // ชั้นนี้พังก็ลองชั้นถัดไป ไม่ใช่ความผิดพลาดที่ต้องหยุดทั้งกระบวนการ
      console.warn("slip-qr: attempt failed", attempt.name, e instanceof Error ? e.message : e);
    }
  }

  return { found: false };
}
