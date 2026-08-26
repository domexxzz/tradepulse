import { prisma } from "@/lib/prisma";
import { approveReview, unapproveReview, deleteReview } from "@/lib/actions/admin";
import { Star } from "lucide-react";

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <h1 className="display text-[length:var(--display-sm)]">รีวิว ({reviews.length})</h1>

      {reviews.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-sm text-muted">
          ยังไม่มีรีวิวในระบบ — section รีวิวบนหน้าแรกจะซ่อนไว้จนกว่าจะมีรีวิวที่อนุมัติแล้วอย่างน้อย 1 รายการ
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="card-surface flex items-start justify-between gap-4 rounded-2xl p-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-brand text-brand" : "text-border"}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{r.userName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.isApproved ? "bg-up/10 text-up" : "bg-amber-400/10 text-amber-400"}`}>
                    {r.isApproved ? "แสดงบนเว็บ" : "รออนุมัติ"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{r.comment}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {r.isApproved ? (
                  <form action={unapproveReview}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="w-full rounded-full bg-surface-2 px-3 py-1.5 text-xs hover:bg-border">ซ่อน</button>
                  </form>
                ) : (
                  <form action={approveReview}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="w-full rounded-full bg-up/15 px-3 py-1.5 text-xs font-medium text-up hover:bg-up/25">อนุมัติ</button>
                  </form>
                )}
                <form action={deleteReview}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <button className="w-full rounded-full bg-down/15 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/25">ลบ</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
