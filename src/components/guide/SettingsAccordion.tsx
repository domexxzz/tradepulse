"use client";

import { useState } from "react";
import { Check, ChevronDown, ClipboardCopy } from "lucide-react";
import type { SettingGroup } from "@/config/guide";

export function SettingsAccordion({ suiteName, groups }: { suiteName: string; groups: SettingGroup[] }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups[0] ? [groups[0].group] : []));
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (group: string) => setOpenGroups((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });

  const copyGroup = async (group: SettingGroup) => {
    try {
      await navigator.clipboard.writeText(`${suiteName} — ${group.group}\n${group.items.map((item) => `• ${item}`).join("\n")}`);
      setCopied(group.group);
      window.setTimeout(() => setCopied(null), 1600);
    } catch { /* Clipboard permissions can be unavailable in embedded browsers. */ }
  };

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2 text-xs"><button type="button" onClick={() => setOpenGroups(new Set(groups.map((group) => group.group)))} className="text-brand hover:underline">เปิดทั้งหมด</button><span className="text-border-strong">·</span><button type="button" onClick={() => setOpenGroups(new Set())} className="text-muted hover:text-foreground">ยุบทั้งหมด</button></div>
      <div className="grid gap-3">
        {groups.map((group) => {
          const open = openGroups.has(group.group);
          return <div key={group.group} className="overflow-hidden rounded-2xl border border-border bg-surface/60"><div className="flex items-center"><button type="button" aria-expanded={open} onClick={() => toggle(group.group)} className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 text-left"><span><span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">{group.group}</span><span className="mt-1 block text-xs text-muted">{group.items.length} ค่า</span></span><ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden /></button><button type="button" onClick={() => copyGroup(group)} className="mr-3 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted hover:border-brand/35 hover:text-brand" aria-label={`คัดลอกค่าตั้ง ${group.group}`}>{copied === group.group ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}</button></div>{open ? <ul className="border-t border-border px-4 py-3 sm:px-5">{group.items.map((item) => <li key={item} className="border-b border-border/60 py-2 text-[13px] leading-relaxed text-foreground/85 last:border-0">{item}</li>)}</ul> : null}</div>;
        })}
      </div>
    </div>
  );
}
