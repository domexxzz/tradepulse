import { Download, FileText } from "lucide-react";
import { MANUAL_PDFS, type ManualPdf } from "@/config/downloads";

/** การ์ดดาวน์โหลดคู่มือ PDF — ใช้หน้าคู่มือ (ทั้งสองเล่ม) */
export function ManualDownloads({ className = "" }: { className?: string }) {
  return (
    <section aria-label="ดาวน์โหลดคู่มือ PDF" className={`card-surface rounded-2xl border-up/25 p-5 ${className}`}>
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <Download className="h-5 w-5 text-up" />
        ดาวน์โหลดคู่มือ PDF เก็บไว้อ่าน
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {MANUAL_PDFS.map((m) => (
          <ManualPdfLink key={m.id} pdf={m} />
        ))}
      </div>
    </section>
  );
}

/** ปุ่มดาวน์โหลดเล่มเดียว — เปิดในแท็บใหม่ (มือถือดูได้ทันที) และมีชื่อไฟล์ภาษาไทยตอนบันทึก */
export function ManualPdfLink({ pdf }: { pdf: ManualPdf }) {
  return (
    <a
      href={pdf.href}
      download={pdf.fileName}
      target="_blank"
      rel="noopener"
      className="group flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 transition hover:border-up/50"
    >
      <FileText className="mt-0.5 h-6 w-6 shrink-0 text-up" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold group-hover:text-up">{pdf.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{pdf.desc}</span>
        <span className="mt-2 block text-xs text-muted">
          PDF · {pdf.pages} หน้า · {pdf.sizeLabel}
        </span>
      </span>
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-muted transition group-hover:text-up" />
    </a>
  );
}
