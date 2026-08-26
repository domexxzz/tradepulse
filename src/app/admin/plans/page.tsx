import { prisma } from "@/lib/prisma";
import { plans as configPlans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export default async function AdminPlansPage() {
  const dbPlans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });

  // ราคาถูกเก็บไว้สองที่ (ไฟล์ config ใช้แสดงผล/คิดเงิน, ตาราง Plan ใช้ผูก Stripe)
  // ถ้าไม่ตรงกันแปลว่ามีที่หนึ่งลืมอัปเดต — เตือนไว้ดีกว่าปล่อยให้ขายผิดราคา
  const mismatched = dbPlans.filter((p) => {
    const cfg = configPlans.find((c) => c.id === p.code);
    return cfg && cfg.priceTHB !== p.priceTHB;
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">แพ็คเกจ</h1>
      <p className="text-sm text-muted">
        ราคาแสดงผลบนหน้าเว็บมาจาก <code className="text-brand">src/config/plans.ts</code> ส่วน Stripe Price ID
        ตั้งใน <code className="text-brand">.env</code> — ตารางนี้คือ Plan ที่บันทึกใน DB (สำหรับผูก subscription)
      </p>

      {mismatched.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-down/30 bg-down/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-down" />
          <div>
            <div className="font-semibold text-down">ราคาใน DB ไม่ตรงกับ src/config/plans.ts</div>
            <ul className="mt-1.5 space-y-0.5 text-muted">
              {mismatched.map((p) => (
                <li key={p.id}>
                  {p.code}: DB {formatTHB(p.priceTHB)} · เว็บแสดง{" "}
                  {formatTHB(configPlans.find((c) => c.id === p.code)!.priceTHB)}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-muted">
              แก้ราคาใน <code className="text-brand">src/config/plans.ts</code> แล้วรัน{" "}
              <code className="text-brand">npm run db:seed</code> เพื่อให้ตรงกัน
            </p>
          </div>
        </div>
      )}

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
