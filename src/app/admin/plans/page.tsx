import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/utils";

export default async function AdminPlansPage() {
  const dbPlans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">แพ็คเกจ</h1>
      <p className="text-sm text-muted">
        ราคาแสดงผลบนหน้าเว็บมาจาก <code className="text-brand">src/config/plans.ts</code> ส่วน Stripe Price ID
        ตั้งใน <code className="text-brand">.env</code> — ตารางนี้คือ Plan ที่บันทึกใน DB (สำหรับผูก subscription)
      </p>

      {dbPlans.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-sm text-muted">
          ยังไม่มี Plan ใน DB — รัน <code className="text-brand">npx prisma db seed</code> เพื่อเพิ่มข้อมูลเริ่มต้น
        </div>
      ) : (
        <div className="card-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border/60 text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">รหัส</th>
                <th className="px-5 py-3 font-medium">ชื่อ</th>
                <th className="px-5 py-3 font-medium">ราคา</th>
                <th className="px-5 py-3 font-medium">Stripe Price ID</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {dbPlans.map((p) => (
                <tr key={p.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-5 py-3">{p.name}</td>
                  <td className="px-5 py-3">{formatTHB(p.priceTHB)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{p.stripePriceId ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={p.isActive ? "text-up" : "text-muted"}>{p.isActive ? "เปิด" : "ปิด"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
