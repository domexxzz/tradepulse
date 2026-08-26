import { cn } from "@/lib/utils";

/**
 * หัวข้อ section — ค่าเริ่มต้นชิดซ้าย
 *
 * ของเดิมจัดกึ่งกลางทุกอัน พอเรียงกัน 20 section เลยอ่านเป็นจังหวะเดียวกันหมด
 * ชิดซ้ายทำให้สายตาเริ่มที่เดิมทุกครั้งและไล่ลงได้เร็วกว่า
 * เหลือกึ่งกลางไว้ใช้เฉพาะ section ที่เป็นบทสรุปจริง ๆ
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div className={cn(centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}>
      {eyebrow && <p className="eyebrow mb-3.5">{eyebrow}</p>}
      <h2 className="display text-[length:var(--display-md)]">{title}</h2>
      {subtitle && <p className="lede mt-4">{subtitle}</p>}
    </div>
  );
}
