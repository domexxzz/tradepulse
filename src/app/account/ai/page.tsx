import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canUseAi, getAiUsage } from "@/lib/ai/chat";
import { aiEngineStatus } from "@/lib/ai/gateway";
import { liveMarkets } from "@/lib/ai/market";
import { AiChat } from "@/components/account/AiChat";
import { Lock, MessageSquarePlus } from "lucide-react";

export const dynamic = "force-dynamic";
// ส่งคำถามผ่าน /api/ai/chat ไม่ใช่ server action — ค่านี้เผื่อไว้ให้หน้าเองโหลดช้าตอนฐานข้อมูลตื่น
export const maxDuration = 30;

export default async function AccountAiPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { c } = await searchParams;

  const allowed = await canUseAi(userId, session!.user.role);

  if (!allowed) {
    return (
      <div className="max-w-xl space-y-6">
        <Header />
        <div className="card-surface space-y-4 rounded-2xl p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4 text-muted" />
            QVX AI สำหรับสมาชิก QVX
          </p>
          <p className="text-sm leading-relaxed text-muted">
            เปิดใช้งาน QVX AI ได้เมื่อบัญชีของคุณมีสิทธิ์ใช้งาน QVX Indicator ที่ Active
            <br />
            รับสิทธิ์ได้จากแพ็กเกจสมาชิก หรือผ่านเงื่อนไข Wisdom
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/#pricing"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-strong"
            >
              เลือกแพ็กเกจ
            </Link>
            <Link href="/account/wisdom" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2">
              รับสิทธิ์ผ่าน Wisdom
            </Link>
          </div>
        </div>
        <Disclaimer />
      </div>
    );
  }

  const [usage, conversations, current, engine, live] = await Promise.all([
    getAiUsage(userId),
    prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true },
    }),
    c
      ? prisma.aiConversation.findFirst({
          where: { id: c, userId },
          select: {
            id: true,
            messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, sources: true } },
          },
        })
      : null,
    aiEngineStatus(),
    liveMarkets(),
  ]);

  return (
    <div className="space-y-6">
      <Header />
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="card-surface h-fit rounded-2xl p-3">
          <Link
            href="/account/ai"
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            <MessageSquarePlus className="h-4 w-4 text-brand" />
            แชตใหม่
          </Link>
          {conversations.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">ยังไม่มีประวัติแชต</p>
          ) : (
            <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <Link
                    href={`/account/ai?c=${conv.id}`}
                    aria-current={conv.id === current?.id ? "page" : undefined}
                    className="block truncate rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground aria-[current=page]:bg-surface-2 aria-[current=page]:text-foreground"
                  >
                    {conv.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <AiChat
          key={current?.id ?? "new"}
          conversationId={current?.id ?? null}
          initialMessages={(current?.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
            sources: m.sources,
          }))}
          initialUsage={usage}
          available={engine.available}
          engine={{ local: engine.local.up, cloud: engine.cloud.configured }}
          live={live}
          notFound={Boolean(c) && !current}
        />
      </div>
      <Disclaimer />
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="display text-[length:var(--display-sm)]">QVX AI</h1>
      <p className="mt-1.5 text-sm text-muted">ผู้ช่วยวิเคราะห์และเรียนรู้การเทรดสำหรับผู้ใช้งาน QVX</p>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="text-xs text-muted">
      QVX AI ให้ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน และไม่รับประกันผลลัพธ์จากการซื้อขาย
    </p>
  );
}
