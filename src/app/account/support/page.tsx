import { site, hasLineContact } from "@/config/site";
import { MessageCircle } from "lucide-react";

export default function SupportPage() {
  const hasEmail = Boolean(site.contact.email);
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold">ช่วยเหลือ</h1>
      <div className="card-surface rounded-2xl p-6">
        <MessageCircle className="h-8 w-8 text-brand" />
        <h2 className="mt-3 font-semibold">ติดต่อทีมงาน</h2>
        <p className="mt-1 text-sm text-muted">
          สอบถามการใช้งาน แจ้งปัญหาสิทธิ์ หรือขอคำแนะนำการใช้ระบบ ทีมงานพร้อมช่วยเหลือ
        </p>
        {hasLineContact ? (
          <a
            href={site.contact.lineUrl}
            className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-strong"
          >
            ติดต่อผ่าน LINE
          </a>
        ) : hasEmail ? (
          <a
            href={`mailto:${site.contact.email}`}
            className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-strong"
          >
            อีเมล {site.contact.email}
          </a>
        ) : (
          <p className="mt-4 text-sm text-muted">ช่องทางติดต่อจะแจ้งให้ทราบเร็ว ๆ นี้</p>
        )}
      </div>
    </div>
  );
}
