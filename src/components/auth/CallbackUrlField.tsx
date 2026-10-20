"use client";
import { useSearchParams } from "next/navigation";

/**
 * ส่ง callbackUrl จาก query string ต่อไปกับฟอร์มเข้าสู่ระบบ/สมัครสมาชิก
 * ฝั่งเซิร์ฟเวอร์กรองซ้ำด้วย safeCallbackPath — ตรงนี้แค่ส่งต่อ ห้ามเชื่อค่า
 *
 * ต้องห่อด้วย <Suspense> ตอนใช้ — useSearchParams ทำให้ส่วนนี้เรนเดอร์ฝั่งเบราว์เซอร์
 * ห่อไว้แล้วส่วนอื่นของหน้ายัง prerender ได้ตามเดิม
 */
export function CallbackUrlField() {
  const callbackUrl = useSearchParams().get("callbackUrl");
  if (!callbackUrl) return null;
  return <input type="hidden" name="callbackUrl" value={callbackUrl} />;
}
