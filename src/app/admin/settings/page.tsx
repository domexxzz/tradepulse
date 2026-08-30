import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PasswordForm, EmailForm } from "./AccountForms";

/**
 * บัญชีของแอดมินเอง — เปลี่ยนรหัสผ่านและผูกอีเมล
 *
 * มีไว้เพราะบัญชีที่ตั้งผ่าน scripts/bootstrap-admin.mjs ไม่มีอีเมล
 * ทำให้ "ลืมรหัสผ่าน?" ใช้ไม่ได้ และไม่มีทางเปลี่ยนรหัสเองเลย
 * ต้องรบกวนคนที่เข้า Vercel ได้ทุกครั้ง
 */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true, name: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">บัญชีแอดมิน</h1>
        <p className="mt-1 text-sm text-muted">
          เปลี่ยนรหัสผ่านและอีเมลของบัญชีที่คุณใช้อยู่ตอนนี้ — ไม่กระทบบัญชีแอดมินคนอื่น
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">ข้อมูลบัญชี</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">ชื่อผู้ใช้</dt>
            <dd className="mt-0.5 font-mono">{me?.username ?? "— (ยังไม่ได้ตั้ง)"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">อีเมล</dt>
            <dd className="mt-0.5">
              {me?.email ?? (
                <span className="text-amber-400">ยังไม่ได้ผูก — กู้รหัสผ่านทางอีเมลไม่ได้</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">
          {me?.email ? "เปลี่ยนอีเมล" : "ผูกอีเมล"}
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          {me?.email
            ? "ใช้ล็อกอินและกู้รหัสผ่านได้ทั้งอีเมลและชื่อผู้ใช้"
            : "ผูกไว้แล้วจะกดปุ่ม “ลืมรหัสผ่าน?” เพื่อกู้บัญชีเองได้ ไม่ต้องรบกวนคนอื่น"}
        </p>
        <EmailForm current={me?.email ?? null} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">เปลี่ยนรหัสผ่าน</h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          ต้องกรอกรหัสเดิมด้วย เพื่อไม่ให้คนที่มาเจอเครื่องเปิดค้างเปลี่ยนรหัสยึดบัญชีไปได้
        </p>
        <PasswordForm />
      </section>
    </div>
  );
}
