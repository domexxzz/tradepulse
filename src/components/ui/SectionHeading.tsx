import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-muted">{subtitle}</p>}
    </div>
  );
}
