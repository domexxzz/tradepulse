/**
 * ข้อมูลสำหรับหน้ากฎหมาย (ข้อกำหนด / ความเป็นส่วนตัว / คืนเงิน)
 * ⚠️ ข้อมูลนิติบุคคลเว้นว่างไว้ — แสดงเฉพาะเมื่อกรอกค่าจริงผ่าน env ห้ามใส่ค่าปลอม
 */
export const legal = {
  /** ชื่อผู้ประกอบการตามที่จดทะเบียน เช่น "บริษัท ... จำกัด" หรือชื่อ-นามสกุลเจ้าของกิจการ */
  entityName: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "",
  /** เลขประจำตัวผู้เสียภาษี / เลขทะเบียนพาณิชย์ */
  taxId: process.env.NEXT_PUBLIC_LEGAL_TAX_ID || "",
  /** ที่อยู่ตามที่จดทะเบียน */
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "",
} as const;

/** มีข้อมูลนิติบุคคลให้แสดงหรือยัง */
export const hasLegalEntity = Boolean(legal.entityName);

/** วันที่แก้ไขนโยบายล่าสุด — อัปเดตทุกครั้งที่แก้เนื้อหาหน้ากฎหมาย */
export const LEGAL_LAST_UPDATED = "24 สิงหาคม 2026";

/** จำนวนวันที่รับประกันคืนเงิน นับจากวันที่ได้รับสิทธิ์ใช้งาน */
export const REFUND_DAYS = 7;

/** จำนวนวันทำการที่ใช้ดำเนินการคืนเงินหลังอนุมัติ */
export const REFUND_PROCESS_DAYS = 15;

/** เก็บภาพสลิปโอนเงินไว้กี่ปี (ใช้เป็นหลักฐานทางบัญชีและภาษี) */
export const SLIP_RETENTION_YEARS = 5;
