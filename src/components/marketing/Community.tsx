import { discordInviteUrl, hasDiscord } from "@/config/site";
import { DiscordIcon } from "@/components/common/DiscordIcon";
import { Button } from "@/components/ui/Button";
import { Users, Lock, MessagesSquare } from "lucide-react";

const DISCORD_BLURPLE = "#5865F2";

export function Community() {
  return (
    <section id="community" className="section-md">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <MessagesSquare className="h-3.5 w-3.5" /> ชุมชน · Discord
          </p>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            เข้าร่วมชุมชนเทรดเดอร์บน Discord
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            เซิร์ฟเวอร์เปิดให้ทุกคนเข้าได้ฟรี ใช้พูดคุยแลกเปลี่ยนมุมมองกับเทรดเดอร์คนอื่น
            ติดตามข่าวสารและอัปเดตของระบบ — สมัครสมาชิกแล้วจะได้สิทธิ์เข้าห้องเฉพาะสมาชิกเพิ่มตามแพ็กเกจที่เลือก
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasDiscord && (
              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: DISCORD_BLURPLE }}
              >
                <DiscordIcon className="h-5 w-5" /> เข้าร่วม Discord ฟรี
              </a>
            )}
            <Button href="#pricing" variant="outline" size="lg">
              ดูแพ็กเกจสมาชิก
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            เข้าเซิร์ฟเวอร์ได้ทันทีโดยไม่ต้องสมัครสมาชิก — ห้องเฉพาะสมาชิกจะเปิดให้หลังยืนยันการชำระเงิน
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="card-surface rounded-2xl p-6">
            <h3 className="text-sm font-semibold">สิทธิ์การเข้าถึงในเซิร์ฟเวอร์</h3>

            <div className="mt-4 space-y-3">
              <AccessRow
                icon={<Users className="h-5 w-5" />}
                title="ห้องเปิด"
                desc="เข้าได้ทุกคน ไม่ต้องเป็นสมาชิก"
                tone="open"
              />
              <AccessRow
                icon={<Lock className="h-5 w-5" />}
                title="ห้องเฉพาะสมาชิก"
                desc="ปลดล็อกตามแพ็กเกจที่สมัคร หลังยืนยันการชำระเงินและผูกบัญชี Discord"
                tone="locked"
              />
            </div>

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted">
              ผูกบัญชี Discord ได้เองในหน้าบัญชี → เมนู Discord แล้วรับยศเข้าห้องสมาชิกทันที
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessRow({
  icon,
  title,
  desc,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "open" | "locked";
}) {
  const isOpen = tone === "open";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3.5">
      <span
        className={
          isOpen
            ? "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"
            : "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"
        }
      >
        {icon}
      </span>
      <div className="leading-snug">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-0.5 text-xs text-muted">{desc}</p>
      </div>
    </div>
  );
}
