import { Check, X, Minus } from "lucide-react";
import type { AccountEvidence, EvidenceCheck } from "@/lib/broker-events";
import { formatThaiDate } from "@/lib/date";

/**
 * หลักฐานจากโบรกของเลขบัญชีหนึ่ง — ให้คนตรวจเห็นว่าอะไรผ่านแล้ว อะไรต้องไปเช็กเอง
 * ตั้งใจไม่ซ่อนข้อที่ "ยังไม่รู้" ไว้เฉย ๆ เพราะคนตรวจต้องรู้ว่าเหลืออะไรที่ระบบยังตอบให้ไม่ได้
 */
export function BrokerEvidence({ evidence, check }: { evidence?: AccountEvidence; check: EvidenceCheck }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {check.lines.map((l) => (
          <li key={l.label} className="flex items-start gap-2 text-xs">
            {l.ok === true ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-up" />
            ) : l.ok === false ? (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-down" />
            ) : (
              <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            )}
            <span className={l.ok === false ? "text-down" : l.ok === true ? "" : "text-muted"}>
              <span className="font-medium">{l.label}</span>
              {l.detail && <span className="text-muted"> — {l.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      {evidence && evidence.events.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none hover:text-foreground">
            เหตุการณ์จากโบรก {evidence.events.length} รายการ
          </summary>
          <ul className="mt-1.5 space-y-1 border-l border-border pl-3">
            {evidence.events.map((e) => (
              <li key={e.id} className="tnum">
                {formatThaiDate(e.occurredAt)} · {e.type === "DEPOSIT" ? "ฝาก" : e.type === "WITHDRAWAL" ? "ถอน" : e.type === "SIGNUP" ? "สมัคร" : "อ่านไม่ออก"}
                {e.amountUSD !== null && ` $${e.amountUSD.toLocaleString()}`}
                {e.source === "manual" && " · บันทึกเอง"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
