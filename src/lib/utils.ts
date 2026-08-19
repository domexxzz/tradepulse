import { clsx, type ClassValue } from "clsx";

/** join className strings conditionally (lightweight, no tailwind-merge dep) */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** format THB currency */
export function formatTHB(amount: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);
}
