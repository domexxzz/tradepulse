import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  brand: "bg-gradient-to-r from-brand-strong to-brand-deep text-black hover:brightness-110 shadow-[0_10px_30px_-10px_rgba(233,185,73,.6)]",
  outline: "border border-brand/40 text-brand hover:bg-brand/10",
  ghost: "text-foreground hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "brand",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <a className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
