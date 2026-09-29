import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { discordBotEnabled } from "@/lib/discord";
import { discordOAuthEnabled } from "@/lib/discord-oauth";
import { discordInviteUrl, hasDiscord } from "@/config/site";
import { unlinkDiscord } from "@/lib/actions/discord";
import { DiscordLinkForm } from "@/components/account/DiscordLinkForm";
import { DiscordIcon } from "@/components/common/DiscordIcon";
import { CheckCircle2, Link2Off, AlertTriangle } from "lucide-react";

/**
 * ข้อความตอบกลับหลังกลับมาจาก Discord
 *
 * ทุกทางออกของ /api/discord/callback ต้องมีข้อความที่นี่ ไม่งั้นลูกค้าจะเจอหน้าเปล่า
 * แล้วไม่รู้ว่าสำเร็จหรือพัง — บอกด้วยว่าให้ทำอะไรต่อ ไม่ใช่แค่บอกว่าพัง
 */
const OUTCOME: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: "เชื่อมต่อเรียบร้อย — เข้าเซิร์ฟเวอร์และได้ยศสมาชิกแล้ว" },
  "linked-nosub": {
    ok: true,
    text: "เชื่อมต่อและเข้าเซิร์ฟเวอร์เรียบร้อย — จะได้ยศสมาชิกอัตโนมัติเมื่อแพ็กเกจเริ่มใช้งาน",
  },
  cancelled: { ok: false, text: "ยกเลิกการเชื่อมต่อแล้ว — กดปุ่มด้านล่างได้อีกครั้งเมื่อพร้อม" },
  // แยกไม่ได้ว่า state หมดอายุหรือถูกแก้ และไม่ควรแยกให้รู้ด้วย ข้อความจึงครอบทั้งสอง
  expired: { ok: false, text: "ลิงก์เชื่อมต่อใช้ไม่ได้หรือหมดอายุแล้ว (มีอายุ 10 นาที) — กดเชื่อมต่อใหม่อีกครั้ง" },
  taken: { ok: false, text: "บัญชี Discord นี้ถูกผูกกับสมาชิกรายอื่นแล้ว — ติดต่อทีมงานถ้าคิดว่าผิดพลาด" },
  joinfailed: {
    ok: false,
    text: "ผูกบัญชีแล้ว แต่พาเข้าเซิร์ฟเวอร์ไม่สำเร็จ — กดลิงก์เชิญเข้าเองได้เลย ทีมงานจะตรวจสอบให้",
  },
  rolefailed: {
    ok: false,
    text: "เข้าเซิร์ฟเวอร์แล้ว แต่ยังให้ยศไม่สำเร็จ — ทีมงานจะจัดการให้ ไม่ต้องทำอะไรเพิ่ม",
  },
  disabled: { ok: false, text: "ระบบเชื่อมต่อ Discord ยังไม่เปิดใช้งาน" },
  failed: { ok: false, text: "เชื่อมต่อไม่สำเร็จ — ลองอีกครั้ง หากยังไม่ได้ให้แจ้งทีมงาน" },
};

export default async function AccountDiscordPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const outcome = sp.discord ? OUTCOME[sp.discord] : undefined;

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
        <h1 className="display text-[length:var(--display-sm)]">Discord</h1>
        <p className="mt-1.5 text-sm text-muted">
          {discordOAuthEnabled
            ? "กดปุ่มเดียว ระบบพาเข้าเซิร์ฟเวอร์และให้ยศเข้าห้องเฉพาะสมาชิกตามแพ็กเกจของคุณเอง"
            : "ผูกบัญชี Discord ไว้ ระบบจะให้ยศเข้าห้องเฉพาะสมาชิกให้อัตโนมัติตามแพ็กเกจของคุณ"}
        </p>
      </div>

      {outcome && (
        <div
          className={`card-surface flex items-start gap-2.5 rounded-xl border p-4 text-sm ${
            outcome.ok ? "border-up/30" : "border-amber-400/30"
          }`}
        >
          {outcome.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-up" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          )}
          <span>{outcome.text}</span>
        </div>
      )}

      {!discordBotEnabled ? (
        <div className="card-surface rounded-xl p-6">
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
            <div className="card-surface rounded-xl p-5">
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

          {/*
            ทางที่ลูกค้าควรใช้: Discord เป็นคนบอกเราเองว่าเป็นใคร แล้วเราพาเข้าเซิร์ฟเวอร์ให้
            ไม่ต้องให้ลูกค้าไปหาชื่อผู้ใช้ตัวเองมากรอก ซึ่งพิมพ์ผิดง่ายและสับสนกับชื่อที่โชว์
            เป็น <a> ธรรมดาไม่ใช่ฟอร์ม เพราะปลายทางเป็นการพาออกไปเว็บ Discord
          */}
          {discordOAuthEnabled ? (
            <div className="card-surface rounded-2xl p-6">
              <a
                href="/api/discord/link"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#5865F2] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <DiscordIcon className="h-4 w-4" />
                {linked ? "เชื่อมต่อ Discord อีกครั้ง" : "เชื่อมต่อ Discord"}
              </a>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                จะพาไปหน้ายืนยันของ Discord — เราขอแค่ให้รู้ว่าเป็นบัญชีไหน
                และขอพาคุณเข้าเซิร์ฟเวอร์ ไม่ได้ขออ่านข้อความหรืออีเมลของคุณ
              </p>
            </div>
          ) : (
            <>
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
        </>
      )}
    </div>
  );
}
