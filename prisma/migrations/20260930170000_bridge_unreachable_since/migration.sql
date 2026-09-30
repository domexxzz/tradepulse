-- /health ตอบไม่ได้ต่อเนื่องมาตั้งแต่เมื่อไหร่ (NULL = ตอบได้ครั้งล่าสุด)
-- lastSeenAt เขียนโดย botkeeper ไม่ใช่ตัวบริดจ์ จึงบอกได้แค่ว่า "เครื่องยังเปิด"
-- ไม่ได้บอกว่าบริดจ์ยังเดิน — คอลัมน์นี้ใช้แยกสองอย่างนั้นออกจากกัน
ALTER TABLE "BridgeEndpoint" ADD COLUMN "unreachableSince" TIMESTAMP(3);
