import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UnsubscribeForm } from "@/components/marketing/UnsubscribeForm";
import { MailX, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "ยกเลิกรับข่าวสาร",
  robots: { index: false, follow: false },
};

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const sub = token
    ? await prisma.subscriber
        .findUnique({
          where: { unsubscribeToken: token },
          select: { email: true, unsubscribedAt: true },
        })
        .catch(() => null)
    : null;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        {!sub ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted">
              <MailX className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold">ลิงก์นี้ใช้ไม่ได้</h1>
            <p className="mt-2 text-sm text-muted">
              ลิงก์อาจหมดอายุหรือถูกใช้ไปแล้ว หากยังต้องการยกเลิกรับข่าวสาร ติดต่อทีมงานได้เลย
            </p>
          </>
        ) : sub.unsubscribedAt ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold">ยกเลิกเรียบร้อยแล้ว</h1>
            <p className="mt-2 text-sm text-muted">
              เราจะไม่ส่งข่าวสารไปที่ {maskEmail(sub.email)} อีก
            </p>
          </>
        ) : (
          <UnsubscribeForm token={token!} email={maskEmail(sub.email)} />
        )}

        <Link
          href="/"
          className="mt-6 inline-flex text-sm text-brand transition-opacity hover:opacity-80"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
