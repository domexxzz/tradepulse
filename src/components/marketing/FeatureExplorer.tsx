import { coreFeatures, advancedTools } from "@/config/features";
import { ExplorerPanel, type ExplorerGroup } from "./ExplorerPanel";

/**
 * "มีอะไรบ้าง" — รวม CoreFeatures + AllFeatures เดิมไว้ในแผงเดียว
 *
 * ของเดิมเป็นสอง section ที่หน้าตาเหมือนกันเป๊ะ (กริดการ์ด 3 คอลัมน์ทั้งคู่)
 * วางติดกันแล้วคนแยกไม่ออกว่าอันไหนจบอันไหนเริ่ม และรวมกันสูงกว่า 3,000px
 * ตอนนี้เหลือ section เดียว โดยความต่างของสองกลุ่มไปอยู่ในหัวข้อย่อยของแถบเลือกแทน
 *
 * section นี้ใช้คอนเทนเนอร์กว้างกว่าที่อื่น (1360 แทน 1180 ของ .container-x)
 * ตั้งใจให้ขอบไม่ตรงกับ section รอบ ๆ เพราะเป็นใจกลางของหน้า และเพราะภาพต้องได้
 * ความกว้างเต็ม 960px ตามขนาดไฟล์จริง ถ้าบีบลงคอนเทนเนอร์ปกติจะเหลือ ~840px
 */
export function FeatureExplorer() {
  const groups: ExplorerGroup[] = [
    { label: "ระบบหลัก", items: coreFeatures.map(toItem) },
    { label: "เครื่องมือขั้นสูง", items: advancedTools.map(toItem) },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section id="features" className="section">
      <div className="mx-auto w-full max-w-[1360px] px-5">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3.5">ฟีเจอร์</p>
          {/* เรียงคำให้จุดตัดบรรทัดตกที่ช่องว่างที่เราวางเอง — ดูหมายเหตุที่ .display ใน globals.css
              ("เครื่องมือทั้งหมด อยู่ในอินดิเคเตอร์เดียว" จะถูกตัดเป็น "...ทั้งหมด อยู่ / ใน...") */}
          <h2 className="display text-[length:var(--display-md)]">
            เครื่องมือทั้งหมด ในอินดิเคเตอร์เดียว
          </h2>
          <p className="lede mt-4">
            เลือกดูทีละตัวได้เลยว่าแต่ละเครื่องมือวาดอะไรลงบนกราฟ — ทั้งหมด {total} รายการ
            เป็นภาพตัวอย่างกราฟบน XAUUSD
          </p>
        </div>

        <ExplorerPanel groups={groups} />
      </div>
    </section>
  );
}

/** ตัดเหลือเฉพาะฟิลด์ที่แผงใช้ — image ผ่าน hasScreenshot มาแล้วจึงไม่มีทางว่าง */
function toItem(f: (typeof coreFeatures)[number]) {
  return {
    title: f.title,
    short: f.short,
    slug: f.slug,
    desc: f.desc,
    howto: f.howto,
    icon: f.icon,
    image: f.image as string,
  };
}
