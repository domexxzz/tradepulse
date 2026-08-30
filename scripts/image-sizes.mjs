/**
 * อ่านขนาดจริง (px) ของภาพใน public/images/ แล้วพิมพ์เป็นตาราง
 *
 * มีไว้เพราะ src/config/features.ts ต้องเก็บ width/height ของทุก screenshot
 * เพื่อกำหนดสัดส่วนกรอบภาพในหน้า /features/[slug] — ถ้าตัวเลขไม่ตรงไฟล์ ภาพจะถูกยืด
 * เวลาสลับรูปใหม่ ให้รันตัวนี้แล้วก๊อปตัวเลขไปใส่ อย่าเดาเอง
 *
 *   npm run images:sizes              ทุกโฟลเดอร์ใน public/images
 *   npm run images:sizes features     เฉพาะโฟลเดอร์ features
 *
 * คอลัมน์ "จอ 2x คมถึง" คือความกว้างสูงสุดที่ไฟล์นี้ยังคมบนจอความละเอียดสูง
 * (= ครึ่งหนึ่งของความกว้างไฟล์) หน้า /features/[slug] วางภาพกว้างสุด 728px
 * ไฟล์ที่ต่ำกว่านั้นจะถูกเบราว์เซอร์ขยาย แล้วตัวหนังสือบนกราฟจะเบลอ
 * — เหตุผลเดียวกับคลิป Hero ที่บันทึกไว้หัวไฟล์ src/config/guide.ts
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * ความกว้างสูงสุดที่หน้า /features/[slug] วางภาพจริง — วัดจากเบราว์เซอร์ ไม่ใช่จากโค้ด
 *
 * หน้านั้นเขียน `container-x max-w-3xl` ซึ่งอ่านแล้วเหมือนกว้าง 768px แต่ max-w-3xl
 * ไม่มีผล เพราะ .container-x (max-width:1180px) อยู่นอก @layer ส่วน utility ของ
 * Tailwind อยู่ใน @layer utilities — CSS นอก layer ชนะทุก layer
 * ช่องจริงจึงเป็น 1180 - 40 (padding-inline ข้างละ 1.25rem) = 1140px
 */
const FEATURE_SLOT_PX = 1140;

const ROOT = "public/images";
const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;

const only = process.argv[2];
const dirs = readdirSync(ROOT).filter(
  (d) => statSync(join(ROOT, d)).isDirectory() && (!only || d === only)
);

if (dirs.length === 0) {
  console.error(`ไม่พบโฟลเดอร์ "${only}" ใน ${ROOT}`);
  process.exit(1);
}

let blurryNow = 0;
let notRetina = 0;

for (const dir of dirs) {
  const files = readdirSync(join(ROOT, dir)).filter((f) => IMAGE_EXT.test(f)).sort();
  if (files.length === 0) continue;

  console.log(`\n${ROOT}/${dir}`);
  for (const file of files) {
    const path = join(ROOT, dir, file);
    const { width, height } = await sharp(path).metadata();
    const kb = Math.round(statSync(path).size / 1024);

    // เตือนเฉพาะโฟลเดอร์ features เพราะรู้ความกว้างช่องวางที่แน่นอนอยู่ช่องเดียว
    // แยกสองระดับ เพราะสองอย่างนี้เร่งด่วนไม่เท่ากัน:
    //   เบลอแล้ว  = แคบกว่าช่อง เบราว์เซอร์ต้องขยาย เห็นเบลอบนจอปกติเลย
    //   ยังไม่ 2x = คมบนจอปกติ แต่จอความละเอียดสูงยังได้ไม่เต็มที่
    let note = "";
    if (dir === "features") {
      if (width < FEATURE_SLOT_PX) {
        blurryNow++;
        note = `  ← เบลอแล้ว (ถูกขยาย ${(FEATURE_SLOT_PX / width).toFixed(2)} เท่า)`;
      } else if (width < FEATURE_SLOT_PX * 2) {
        notRetina++;
        note = "  · ยังไม่พอสำหรับจอ 2x";
      }
    }

    console.log(
      `  ${file.padEnd(38)} ${`${width}x${height}`.padEnd(11)} ${(width / height).toFixed(2)}:1  ` +
        `${String(kb).padStart(4)}KB${note}`
    );
  }
}

if (blurryNow > 0) {
  console.log(
    `\n⛔ ${blurryNow} ไฟล์แคบกว่าช่อง ${FEATURE_SLOT_PX}px — เบลอบนจอปกติ ต้องตัดใหม่ก่อน`
  );
}
if (notRetina > 0) {
  console.log(
    `\n· ${notRetina} ไฟล์คมบนจอปกติแล้ว แต่ยังไม่ถึง ${FEATURE_SLOT_PX * 2}px จึงยังไม่เต็มที่บนจอ 2x`
  );
}
if (blurryNow + notRetina > 0) {
  console.log(`  วิธีตัดรูปใหม่อยู่ใน ${ROOT}/features/README.txt`);
}
