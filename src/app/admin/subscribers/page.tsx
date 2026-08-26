import { prisma } from "@/lib/prisma";
import { Mail } from "lucide-react";

export default async function AdminSubscribersPage() {
  const [subscribers, total, active] = await Promise.all([
    prisma.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.subscriber.count(),
    prisma.subscriber.count({ where: { unsubscribedAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">ผู้รับข่าวสาร ({total})</h1>
        <p className="mt-1 text-sm text-muted">
          อีเมลจากคนที่สนใจแต่ยังไม่ได้สมัครแพ็กเกจ — ยังรับข่าวสารอยู่ {active} รายการ
        </p>
      </div>

      {subscribers.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-sm text-muted">
          ยังไม่มีใครสมัครรับข่าวสาร ฟอร์มอยู่ท้ายหน้าแรกของเว็บ
        </div>
      ) : (
        <>
          <div className="card-surface overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">อีเมล</th>
                  <th className="px-5 py-3 font-medium">ที่มา</th>
                  <th className="px-5 py-3 font-medium">วันที่สมัคร</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted" />
                        {s.email}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">{s.source}</td>
                    <td className="px-5 py-3 text-muted">
                      {s.createdAt.toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      {s.unsubscribedAt ? (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                          ยกเลิกแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-up/10 px-2 py-0.5 text-[10px] text-up">
                          รับข่าวสาร
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 200 && (
            <p className="text-xs text-muted">แสดง 200 รายการล่าสุด จากทั้งหมด {total} รายการ</p>
          )}
        </>
      )}
    </div>
  );
}
