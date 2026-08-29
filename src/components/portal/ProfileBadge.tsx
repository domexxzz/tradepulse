import { Check } from "lucide-react";

export interface PortalProfile {
  /** ชื่อหรืออีเมลของคนที่ล็อกอินอยู่ */
  name: string;
  /**
   * ยืนยันเป็นสมาชิกแล้วหรือยัง — ตัวกำหนดว่าจะขึ้นเครื่องหมายถูกบนไอคอนไหม
   * ค่านี้ต้องมาจาก isSubscriptionActive() เท่านั้น ห้ามดูแค่ว่ามีแพ็กเกจในระบบ
   * เพราะแพ็กเกจที่หมดอายุแล้วก็ยังมี record ค้างอยู่
   */
  isMember: boolean;
  /** เหลืออีกกี่วัน — แสดงต่อท้ายเมื่อรู้ค่า */
  daysLeft?: number | null;
}

/**
 * ไอคอนโปรไฟล์ + ตราสมาชิก บนหัวพอร์ทัล
 *
 * ของเดิมมีแค่ชื่อเป็นตัวหนังสือลอย ๆ ไม่มีอะไรบอกว่าสมัครสำเร็จแล้วหรือยัง
 * คนที่เพิ่งโอนเงินและรอทีมงานยืนยัน ต้องเดาเอาเองว่าได้สิทธิ์หรือยัง
 *
 * ⚠️ ใช้ตัวอักษรแรกเป็นไอคอน ไม่ดึง session.user.image มาแสดง
 * เพราะระบบล็อกอินเป็นแบบอีเมล/รหัสผ่าน ค่านั้นจึงเป็น null เสมอในตอนนี้
 * และถ้าวันหน้าเพิ่ม OAuth ต้องตั้ง images.remotePatterns ใน next.config ก่อน
 * ไม่งั้น next/image จะโยน error ตอน runtime
 */
export function ProfileBadge({ name, isMember, daysLeft }: PortalProfile) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative shrink-0">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-full border border-border-card bg-surface-2 font-display text-sm font-semibold text-foreground"
        >
          {initial}
        </span>

        {isMember && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-brand ring-2 ring-background">
            <Check className="h-2.5 w-2.5 text-brand-ink" strokeWidth={4} aria-hidden />
            {/* ชื่อสถานะสำหรับ screen reader — บนมือถือข้อความข้าง ๆ ถูกซ่อน
                ถ้าไม่มีบรรทัดนี้ ตราสมาชิกจะไม่มีความหมายให้คนใช้ screen reader เลย */}
            <span className="sr-only">สมาชิกที่ยืนยันแล้ว</span>
          </span>
        )}
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm text-foreground">{name}</p>
        {isMember ? (
          <p className="text-[11px] font-medium text-brand">
            สมาชิก
            {typeof daysLeft === "number" && daysLeft >= 0 ? ` · เหลือ ${daysLeft} วัน` : ""}
          </p>
        ) : (
          <p className="text-[11px] text-faint">ยังไม่ได้เป็นสมาชิก</p>
        )}
      </div>
    </div>
  );
}
