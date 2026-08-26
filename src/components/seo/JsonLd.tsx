/**
 * ฝัง structured data (JSON-LD) ให้ Google เข้าใจว่าหน้านี้คืออะไร
 *
 * ส่งหลายก้อนมา = แตกเป็น <script> คนละอัน ไม่ยัดเป็นอาร์เรย์ก้อนเดียว
 * เพราะสเปกอนุญาตให้ใส่อาร์เรย์ก็จริง แต่ตัวอ่านหลายตัว (รวมถึงบางส่วนของ Safari
 * และเครื่องมือตรวจ schema) สมมติว่าเจอออบเจกต์เดี่ยวเสมอ แล้วไปเรียก
 * r["@context"].toLowerCase() ซึ่งพังทันทีเมื่อ r เป็นอาร์เรย์
 * แยกเป็นก้อนละ script จบปัญหาและยังถูกต้องตามสเปกเหมือนเดิม
 *
 * ใช้ dangerouslySetInnerHTML เพราะสเปกกำหนดให้อยู่ใน <script> จริง ไม่ใช่ text node
 * ข้อมูลที่ส่งเข้ามาเป็นค่าคงที่จากไฟล์ config ของเราเอง ไม่ใช่ input จากผู้ใช้
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const blocks = Array.isArray(data) ? data : [data];

  return (
    <>
      {blocks.map((block, i) => (
        <script
          // ลำดับคงที่เพราะมาจากไฟล์ config ไม่ได้สลับตำแหน่งระหว่างเรนเดอร์
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(block).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
