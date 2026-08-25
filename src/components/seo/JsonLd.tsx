/**
 * ฝัง structured data (JSON-LD) ให้ Google เข้าใจว่าหน้านี้คืออะไร
 * ใช้ dangerouslySetInnerHTML เพราะสเปกกำหนดให้อยู่ใน <script> จริง ไม่ใช่ text node
 * ข้อมูลที่ส่งเข้ามาเป็นค่าคงที่จากไฟล์ config ของเราเอง ไม่ใช่ input จากผู้ใช้
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
