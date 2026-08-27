import { Check } from "lucide-react";
import type { GuideSuite } from "@/config/guide";

export function GuideComparison({ suites }: { suites: GuideSuite[] }) {
  return (
    <section id="overview" className="mt-10 scroll-mt-36 rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">เทียบ 3 ชุดก่อนเริ่มตั้งค่า</h2>
      <p className="mt-2 text-sm text-muted">ทุกชุดใช้ร่วมกันได้ ตารางนี้ช่วยเลือกมุมมองหลักที่ควรเริ่มก่อน</p>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-sm"><thead><tr className="border-y border-border text-xs text-muted"><th className="py-3 pr-4">ชุด</th><th className="px-4 py-3">เหมาะกับ</th><th className="px-4 py-3">กรอบเวลา</th><th className="pl-4 py-3">คีย์หลัก</th></tr></thead><tbody>{suites.map((suite) => <tr key={suite.id} className="border-b border-border last:border-0"><th className="py-4 pr-4"><span className="text-[10px] font-semibold text-brand">{suite.badge}</span><span className="mt-1 block font-semibold">{suite.name}</span></th><td className="px-4 py-4 text-muted">{suite.bestFor}</td><td className="px-4 py-4 text-muted">{suite.timeframe}</td><td className="pl-4 py-4"><span className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />{suite.keyLine}</span></td></tr>)}</tbody></table></div>
    </section>
  );
}
