import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/components/account/ReviewForm";
import { Star, Clock, CheckCircle2 } from "lucide-react";

export default async function AccountReviewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [existing, hasSubscribed] = await Promise.all([
    prisma.review.findFirst({
      where: { userId },
      select: { rating: true, comment: true, isApproved: true, createdAt: true },
    }),
    prisma.subscription.findFirst({ where: { userId }, select: { id: true } }),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">รีวิวของฉัน</h1>
        <p className="mt-1.5 text-sm text-muted">
          เล่าประสบการณ์ใช้งานจริงให้คนที่กำลังตัดสินใจได้อ่าน รีวิวจะขึ้นหน้าเว็บหลังทีมงานตรวจ
        </p>
      </div>

      {existing && (
        <div className="card-surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < existing.rating ? "fill-brand text-brand" : "text-border"}`}
                />
              ))}
            </div>
            {existing.isApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-up/10 px-2.5 py-0.5 text-xs font-medium text-up">
                <CheckCircle2 className="h-3.5 w-3.5" /> แสดงบนหน้าเว็บแล้ว
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                <Clock className="h-3.5 w-3.5" /> รอทีมงานตรวจ
              </span>
            )}
          </div>
          <p className="mt-2.5 text-sm text-muted">{existing.comment}</p>
        </div>
      )}

      {hasSubscribed ? (
        <ReviewForm
          defaultName={session!.user.name ?? ""}
          current={
            existing
              ? { rating: existing.rating, comment: existing.comment, isApproved: existing.isApproved }
              : null
          }
        />
      ) : (
        <div className="card-surface rounded-2xl p-6">
          <h2 className="font-semibold">ยังส่งรีวิวไม่ได้</h2>
          <p className="mt-1.5 text-sm text-muted">
            เรารับรีวิวจากสมาชิกที่เคยสมัครแพ็กเกจแล้วเท่านั้น เพื่อให้รีวิวบนหน้าเว็บมาจากคนที่ใช้งานจริง
          </p>
          <Link
            href="/account/subscription"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-background transition-colors hover:bg-brand-strong"
          >
            ดูแพ็กเกจ
          </Link>
        </div>
      )}
    </div>
  );
}
