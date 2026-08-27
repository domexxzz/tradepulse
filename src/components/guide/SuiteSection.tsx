import Image from "next/image";
import { AlertTriangle, Check, Eye, Repeat, SlidersHorizontal } from "lucide-react";
import type { GuideSuite } from "@/config/guide";
import { LoopingClip } from "@/components/guide/LoopingClip";
import { GuideChart } from "@/components/guide/GuideChart";
import { SettingsAccordion } from "@/components/guide/SettingsAccordion";
import { SetupChecklist } from "@/components/guide/SetupChecklist";

/**
 * หนึ่งชุดอินดิเคเตอร์บนหน้า /guide
 *
 * ลำดับการเล่า: เห็นหน้าชาร์ตก่อน → ดูคลิปว่ามันขยับยังไง → แล้วค่อยลงรายละเอียด
 * ว่าเปิดอะไร ตั้งค่าเท่าไร ใช้ตอนไหน และไม่ควรใช้ตอนไหน
 * การ์ดสรุปภาพอยู่ท้ายสุด เพราะเป็นของไว้เซฟไปเปิดตอนตั้งค่าจริง ไม่ใช่ของไว้อ่านบนเว็บ
 */
export function SuiteSection({ suite }: { suite: GuideSuite }) {
  return (
    <section id={suite.id} className="scroll-mt-20 border-t border-border pt-14">
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            {suite.badge}
          </span>
          <span className="text-xs text-muted">{suite.timeframe}</span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{suite.name}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">{suite.tagline}</p>
        <p className="mt-4 inline-flex rounded-lg border border-brand/30 bg-brand/5 px-3.5 py-2 text-sm">
          <span className="text-muted">เหมาะสุดกับ&nbsp;</span>
          <span className="font-semibold text-brand">{suite.bestFor}</span>
        </p>
      </header>

      <GuideChart suiteId={suite.id} suiteName={suite.name} chart={suite.chart} />

      <div className="guide-detail-only mt-6 grid gap-5 md:grid-cols-2">
        {suite.videos.map((v) => (
          <figure
            key={v.src}
            className="overflow-hidden rounded-2xl border border-border bg-surface p-1.5"
          >
            <LoopingClip src={v.src} poster={v.poster} label={v.label} />
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Repeat className="h-3 w-3 text-brand" />
                {v.label}
              </span>
              <span className="tabular-nums">วนซ้ำ · {v.duration}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <ListCard icon={<Eye className="h-4 w-4" />} title="สิ่งที่เห็นบนกราฟ" items={suite.onChart} />
        <ListCard
          icon={<Check className="h-4 w-4" />}
          title="ต้องเปิดฟังก์ชันอะไรบ้าง"
          items={suite.enable}
          checklist
        />
      </div>

      <div className="mt-8">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          ค่าตั้งสำคัญที่ทำให้ได้หน้าชาร์ตแบบนี้
        </h3>
        <div className="mt-4"><SettingsAccordion suiteName={suite.name} groups={suite.settings} /></div>
        <p className="mt-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm">
          <span className="font-semibold text-brand">คีย์หลัก</span>
          <span className="text-muted"> — {suite.keyLine}</span>
        </p>
      </div>

      <div className="guide-detail-only mt-8 grid gap-5 md:grid-cols-2">
        <ListCard
          icon={<Check className="h-4 w-4" />}
          title="แนวใช้งานที่เวิร์ก"
          items={suite.playbook}
          checklist
        />
        <ListCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="ไม่เด่น / ต้องระวัง"
          items={suite.cautions}
          tone="warn"
        />
      </div>

      <SetupChecklist suiteId={suite.id} steps={suite.steps} />

      <div className="guide-detail-only mt-8">
        <h3 className="font-display text-lg font-semibold">การ์ดสรุปไว้เปิดตอนตั้งค่า</h3>
        <p className="mt-2 text-sm text-muted">
          กดที่ภาพเพื่อดูขนาดเต็ม แล้วเซฟไว้เปิดคู่กับ TradingView ได้เลย
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suite.cards.map((c) => (
            <a
              key={c.src}
              href={c.src}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-2xl border border-border transition-colors hover:border-brand/40"
              download
            >
              <Image
                src={c.src}
                alt={c.alt}
                width={c.width}
                height={c.height}
                className="h-auto w-full"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** รายการหัวข้อย่อยในกรอบเดียว — ใช้ซ้ำหลายที่ในหนึ่งชุด จึงแยกออกมาแทนที่จะ copy markup */
function ListCard({
  icon,
  title,
  items,
  checklist = false,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  checklist?: boolean;
  tone?: "default" | "warn";
}) {
  const accent = tone === "warn" ? "text-amber-400" : "text-brand";
  const dot = tone === "warn" ? "bg-amber-400" : "bg-brand";

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <span className={accent}>{icon}</span>
        {title}
      </h3>
      <ul className="mt-3.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
            {checklist ? (
              <Check className={`mt-1 h-3.5 w-3.5 shrink-0 ${accent}`} />
            ) : (
              <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${dot}`} />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
