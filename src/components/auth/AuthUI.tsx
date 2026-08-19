import Link from "next/link";
import { site } from "@/config/site";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="hero-backdrop grid min-h-screen place-items-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-strong to-brand-deep font-display text-base font-bold text-black">
            {site.name.charAt(0)}
          </span>
          <span className="font-display text-xl font-bold">{site.name}</span>
        </Link>
        <div className="card-surface rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function Field({
  name,
  type,
  label,
  placeholder,
}: {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

export function SubmitBtn({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-full bg-gradient-to-r from-brand-strong to-brand-deep text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "กำลังดำเนินการ…" : children}
    </button>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
      {msg}
    </div>
  );
}
