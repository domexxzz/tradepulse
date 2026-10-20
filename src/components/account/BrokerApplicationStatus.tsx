import type { BrokerApplication } from "@prisma/client";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { rejectionMessage } from "@/lib/broker";
import { BROKER_APPLICATION_STATUS as S } from "@/config/status";
import { formatThaiDate } from "@/lib/date";

/**
 * การ์ดสถานะคำขอล่าสุด — ใช้ทั้งหน้า /account/wisdom และ /activation
 * ข้อความต้องเหมือนกันทั้งสองหน้า ลูกค้าเห็นต่างกันแล้วจะทักมาถามว่าอันไหนจริง
 */
export function BrokerApplicationStatus({
  latest,
  isActive,
  periodEnd,
}: {
  latest: BrokerApplication;
  isActive: boolean;
  periodEnd: Date | null;
}) {
  const waiting = latest.status === S.PENDING || latest.status === S.REVIEWING;

  return (
    <div className="card-surface rounded-xl p-5">
      {waiting && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="font-medium">รอทีมงานตรวจสอบ</span>
          <span className="text-muted">· ส่งเมื่อ {formatThaiDate(latest.createdAt)}</span>
        </p>
      )}
      {latest.status === S.APPROVED && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-up" />
          <span className="font-medium">ผ่านการตรวจสอบแล้ว</span>
          {isActive && periodEnd && (
            <span className="text-muted">· ใช้งานได้ถึง {formatThaiDate(periodEnd)}</span>
          )}
        </p>
      )}
      {latest.status === S.REJECTED && (
        <div className="text-sm">
          <p className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-down" />
            <span className="font-medium">คำขอไม่ผ่าน</span>
          </p>
          <p className="mt-1.5 text-muted">{rejectionMessage(latest.rejectionReason, latest.reviewNote)}</p>
          {/* คำขอต่ออายุไม่ผ่าน ไม่ได้แปลว่าสิทธิ์รอบนี้โดนตัด — บอกให้ชัด ไม่งั้นลูกค้าตกใจ */}
          {isActive && periodEnd && (
            <p className="mt-1.5 text-muted">สิทธิ์รอบปัจจุบันยังใช้ได้ถึง {formatThaiDate(periodEnd)}</p>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted tnum">เลขบัญชี {latest.tradingAccount}</p>
    </div>
  );
}
