import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { emailEnabled } from "@/lib/email";
import { BroadcastForm } from "@/components/admin/BroadcastForm";

export default async function AdminNewsletterPage() {
  const [active, total] = await Promise.all([
    prisma.subscriber.count({ where: { unsubscribedAt: null } }),
    prisma.subscriber.count(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">ส่งข่าวสาร</h1>
        <p className="mt-1.5 text-sm text-muted">
          ส่งถึงผู้ที่สมัครรับข่าวสารและยังไม่ได้ยกเลิก ({active} จาก {total} รายการ) —{" "}
          <Link href="/admin/subscribers" className="text-brand hover:underline">
            ดูรายชื่อ
          </Link>
        </p>
      </div>

      {!emailEnabled ? (
        <div className="card-surface rounded-xl p-6">
          <h2 className="font-semibold">ยังส่งอีเมลไม่ได้</h2>
          <p className="mt-1.5 text-sm text-muted">
            ต้องตั้งค่า <code className="text-brand">RESEND_API_KEY</code> และ{" "}
            <code className="text-brand">EMAIL_FROM</code> ก่อน ดูขั้นตอนใน docs/EMAIL.md
          </p>
        </div>
      ) : (
        <BroadcastForm recipients={active} />
      )}
    </div>
  );
}
