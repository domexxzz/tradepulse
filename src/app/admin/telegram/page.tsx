import { prisma } from "@/lib/prisma";
import { grantTelegram, revokeTelegram, unlinkTelegram } from "@/lib/actions/admin";
import { telegramGroupManaged } from "@/lib/telegram";
import { formatThaiDate } from "@/lib/date";

const statusStyle: Record<string, string> = {
  PENDING: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  PENDING_REMOVE: "text-down border-down/30 bg-down/10",
  ADDED: "text-up border-up/30 bg-up/10",
  REMOVED: "text-muted border-border bg-surface-2",
};
const statusLabel: Record<string, string> = {
  PENDING: "รอเข้ากลุ่ม",
  PENDING_REMOVE: "หมดอายุ — รอนำออก",
  ADDED: "อยู่ในกลุ่มแล้ว",
  REMOVED: "นำออกแล้ว",
};

export default async function TelegramQueuePage() {
  const grants = await prisma.telegramGrant.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      note: true,
      inviteLink: true,
      telegramUserId: true,
      invitedAt: true,
      createdAt: true,
      // telegramUserId ใช้ตัดสินว่าจะโชว์ปุ่มปลดผูกไหม ไม่ได้เอามาแสดง
      user: {
        select: { name: true, email: true, telegramUsername: true, telegramUserId: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">สิทธิ์กลุ่ม Telegram</h1>
        {telegramGroupManaged ? (
          <p className="mt-1 text-sm text-muted">
            ระบบอัตโนมัติเปิดอยู่ — สมาชิกได้ลิงก์เชิญส่วนตัวในหน้าบัญชี ระบบอนุมัติให้เองเมื่อตรวจแล้วว่าจ่ายเงินจริง
            และนำออกให้อัตโนมัติเมื่อหมดอายุ ปุ่มด้านล่างไว้แก้เคสที่ระบบทำไม่สำเร็จ
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            ยังไม่ได้เปิดระบบอัตโนมัติ (ต้องตั้ง TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID และ webhook)
            — เพิ่ม/นำออกจากกลุ่มเองแล้วกดปุ่มบันทึกสถานะ
          </p>
        )}
      </div>

      {grants.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-sm text-muted">ยังไม่มีคำขอสิทธิ์ Telegram</div>
      ) : (
        <div className="card-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">สมาชิก</th>
                <th className="px-5 py-3 font-medium">Telegram</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">ล่าสุด</th>
                <th className="px-5 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-border align-top last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{g.user.name ?? "—"}</div>
                    <div className="text-xs text-muted">{g.user.email}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {g.user.telegramUsername ? (
                      <div className="font-mono">@{g.user.telegramUsername}</div>
                    ) : g.telegramUserId ? (
                      <div className="font-mono">id {g.telegramUserId}</div>
                    ) : g.inviteLink ? (
                      <span className="text-muted">ส่งลิงก์แล้ว ยังไม่ได้กดเข้า</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${statusStyle[g.status]}`}>
                      {statusLabel[g.status] ?? g.status}
                    </span>
                    {g.note && <div className="mt-1.5 max-w-[260px] text-xs text-muted">{g.note}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {formatThaiDate(g.invitedAt ?? g.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {g.status !== "ADDED" && (
                        <form action={grantTelegram}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25">
                            บันทึกว่าอยู่ในกลุ่ม
                          </button>
                        </form>
                      )}
                      {g.status !== "REMOVED" && (
                        <form action={revokeTelegram}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button className="rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25">
                            นำออก
                          </button>
                        </form>
                      )}
                      {/*
                        ปลดบัญชี Telegram ออกจากสมาชิกคนนี้ ให้เอาไปผูกกับคนอื่นได้
                        โชว์เฉพาะแถวที่ผูกไว้จริง เพราะแถวที่ยังไม่ผูกกดไปก็ไม่เกิดอะไร
                        ไม่ใช่การนำออกจากกลุ่ม — สมาชิกยังอยู่ในกลุ่มเหมือนเดิม
                      */}
                      {g.user.telegramUserId && (
                        <form action={unlinkTelegram}>
                          <input type="hidden" name="grantId" value={g.id} />
                          <button
                            title="ล้างการผูกบัญชี Telegram ของสมาชิกคนนี้ เพื่อให้บัญชี Telegram นั้นเอาไปผูกกับสมาชิกคนอื่นได้ (ไม่ได้นำออกจากกลุ่ม)"
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-brand/40 hover:text-brand"
                          >
                            ปลดผูก Telegram
                          </button>
                        </form>
                      )}
                    </div>
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
