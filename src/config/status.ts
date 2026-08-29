/**
 * ค่าสถานะทั้งหมดที่ระบบใช้ — แหล่งเดียวสำหรับทุกตาราง
 *
 * ทำไมต้องมีไฟล์นี้:
 * คอลัมน์ status ทุกตัวเป็น String ในฐานข้อมูล ไม่ใช่ enum จึงไม่มีอะไรกันการพิมพ์ผิด
 * ตัวที่อันตรายที่สุดคือ Payment.status — ถ้าฝั่งเขียนใช้ "paid" แต่ฝั่งนับใช้ "PAID"
 * countPaidMembers() จะนับไม่เจอ แล้ว "ที่นั่งโปร 300" จะรีเซ็ตกลับไปเต็มจำนวน
 * ราคาที่ลูกค้าเห็นเพี้ยนทันทีโดยไม่มี error ให้จับ
 *
 * ⚠️ Payment.status เป็นตัวพิมพ์เล็ก ต่างจากตารางอื่นที่เป็นตัวใหญ่ทั้งหมด
 * ไม่ได้ตั้งใจให้ต่าง แต่แก้ทีหลังต้องแปลงข้อมูลเดิมด้วย จึงคงไว้ก่อน
 * และมัดไว้ในค่าคงที่นี้แทน — จุดที่เขียนกับจุดที่อ่านชี้ตัวเดียวกันแล้วเพี้ยนไม่ได้
 *
 * ค่าทั้งหมดถอดจากโค้ดที่ใช้งานจริง ไม่ได้เดา
 * ถ้าเพิ่มค่าใหม่ ต้องเพิ่มที่นี่ที่เดียว
 */

/** ฐานข้อมูลเก็บเป็นตัวพิมพ์เล็ก ไม่เหมือนตารางอื่น — ดูหมายเหตุหัวไฟล์ */
export const PAYMENT_STATUS = { PAID: "paid" } as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "ACTIVE",
  TRIALING: "TRIALING",
  INACTIVE: "INACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
} as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const ACCESS_GRANT_STATUS = {
  PENDING: "PENDING",
  GRANTED: "GRANTED",
  REVOKED: "REVOKED",
  PENDING_REVOKE: "PENDING_REVOKE",
} as const;
export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUS)[keyof typeof ACCESS_GRANT_STATUS];

export const TELEGRAM_GRANT_STATUS = {
  PENDING: "PENDING",
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  PENDING_REMOVE: "PENDING_REMOVE",
} as const;
export type TelegramGrantStatus = (typeof TELEGRAM_GRANT_STATUS)[keyof typeof TELEGRAM_GRANT_STATUS];

export const SLIP_ORDER_STATUS = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type SlipOrderStatus = (typeof SLIP_ORDER_STATUS)[keyof typeof SLIP_ORDER_STATUS];

/** ผลตรวจสลิปอัตโนมัติ — VERIFIED เท่านั้นที่ปลอดภัยพอให้บอทอนุมัติเอง */
export const SLIP_VERIFY_STATUS = {
  VERIFIED: "VERIFIED",
  MISMATCH: "MISMATCH",
  DUPLICATE: "DUPLICATE",
  WRONG_ACCOUNT: "WRONG_ACCOUNT",
  STALE: "STALE",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type SlipVerifyStatus = (typeof SLIP_VERIFY_STATUS)[keyof typeof SLIP_VERIFY_STATUS];

export const USER_ROLE = { USER: "USER", ADMIN: "ADMIN" } as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
