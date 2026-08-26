import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none";

/**
 * มีปุ่มเดียวที่ "ดัง" ได้ในหนึ่งหน้าจอ — brand ใช้กับการกระทำหลักเท่านั้น
 * ที่เหลือเป็น outline สีกลาง ไม่ใช่เขียว เพื่อไม่ให้แย่งสายตากับปุ่มหลัก
 * (ของเดิม outline เป็นเขียวด้วย เลยมีเขียวสองปุ่มติดกันตลอด)
 */
const variants: Record<Variant, string> = {
  brand:
    "bg-brand text-brand-ink font-semibold hover:bg-brand-strong " +
    "shadow-[0_8px_28px_-12px_rgba(110,227,74,.55)] hover:shadow-[0_10px_34px_-10px_rgba(110,227,74,.7)]",
  outline:
    "border border-border-strong text-foreground hover:border-brand/50 hover:text-brand hover:bg-brand-wash",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-[3.25rem] px-8 text-[.95rem]",
};

export interface ButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "brand", size = "md", ...props }: ButtonProps) {
  return <a className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
