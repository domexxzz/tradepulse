import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { discordBotEnabled } from "@/lib/discord";
import { discordInviteUrl, hasDiscord } from "@/config/site";
import { unlinkDiscord } from "@/lib/actions/discord";
import { DiscordLinkForm } from "@/components/account/DiscordLinkForm";
import { DiscordIcon } from "@/components/common/DiscordIcon";
import { CheckCircle2, Link2Off } from "lucide-react";

export default async function AccountDiscordPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, { isActive }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { discordUserId: true, discordUsername: true },
    }),
    getUserSubscription(userId),
  ]);

  const linked = Boolean(user?.discordUserId);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Discord</h1>
        <p className="mt-1.5 text-sm text-muted">
          ผูกบัญชี Discord ไว้ ระบบจะให้ยศเข้าห้องเฉพาะสมาชิกให้อัตโนมัติตามแพ็กเกจของคุณ
        </p>
      </div>

      {!discordBotEnabled ? (
        <div className="card-surface rounded-2xl p-6">
          <h2 className="font-semibold">ระบบให้ยศอัตโนมัติยังไม่เปิดใช้งาน</h2>
          <p className="mt-1.5 text-sm text-muted">
            ระหว่างนี้เข้าเซิร์ฟเวอร์แล้วแจ้งชื่อผู้ใช้ Discord กับทีมงาน เพื่อรับสิทธิ์ห้องสมาชิก
          </p>
          {hasDiscord && (
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#5865F2] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <DiscordIcon className="h-4 w-4" /> เปิด Discord
            </a>
          )}
        </div>
      ) : (
        <>
          {linked && (
            <div className="card-surface rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-up" />
                <span className="text-sm font-medium">ผูกกับ {user?.discordUsername}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    isActive ? "bg-up/10 text-up" : "bg-surface-2 text-muted"
                  }`}
                >
                  {isActive ? "ได้รับยศสมาชิกแล้ว" : "รอแพ็กเกจเริ่มใช้งาน"}
                </span>
              </div>
              <form action={unlinkDiscord} className="mt-4">
                <button className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-down">
                  <Link2Off className="h-3.5 w-3.5" /> ยกเลิกการผูกบัญชี
                </button>
              </form>
            </div>
          )}

          <ol className="card-surface space-y-2.5 rounded-2xl p-6 text-sm text-muted">
            <li className="font-medium text-foreground">ขั้นตอน</li>
            <li>
              1. เข้าเซิร์ฟเวอร์ Discord ของเราก่อน{" "}
              {hasDiscord && (
                <a
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline underline-offset-2"
                >
                  เปิดลิงก์เชิญ
                </a>
              )}
            </li>
            <li>2. กรอกชื่อผู้ใช้ Discord ของคุณด้านล่าง แล้วกดผูกบัญชี</li>
            <li>3. ระบบจะตรวจว่าคุณอยู่ในเซิร์ฟเวอร์จริง แล้วให้ยศตามแพ็กเกจทันที</li>
          </ol>

          <DiscordLinkForm current={user?.discordUsername ?? null} />
        </>
      )}
    </div>
  );
}
