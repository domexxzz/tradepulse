import { SectionHeading } from "@/components/ui/SectionHeading";
import { prisma } from "@/lib/prisma";
import { plans } from "@/config/plans";
import { Star } from "lucide-react";

const MAX_SHOWN = 6;

type PublicReview = {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  plan: string | null;
  createdAt: Date;
};

/** ดึงเฉพาะรีวิวที่แอดมินอนุมัติแล้ว — ถ้าต่อฐานข้อมูลไม่ได้ให้คืนค่าว่าง ไม่ทำให้หน้าเว็บพัง */
async function getApprovedReviews(): Promise<PublicReview[]> {
  try {
    return await prisma.review.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: MAX_SHOWN,
      select: { id: true, userName: true, rating: true, comment: true, plan: true, createdAt: true },
    });
  } catch {
    return [];
  }
}

export async function Reviews() {
  const reviews = await getApprovedReviews();

  // ยังไม่มีรีวิวจริง = ไม่แสดง section เลย ดีกว่าโชว์ช่องว่างหรือรีวิวปลอม
  if (reviews.length === 0) return null;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <section id="reviews" className="border-y border-border bg-surface section">
      <div className="container-x">
        <SectionHeading
          eyebrow="เสียงจากสมาชิก"
          title="รีวิวจากคนที่ใช้งานจริง"
          subtitle="ทุกรีวิวมาจากสมาชิกที่สมัครแพ็กเกจแล้ว และผ่านการตรวจสอบจากทีมงาน"
        />

        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i < Math.round(avg) ? "fill-brand text-brand" : "text-border"}`}
              />
            ))}
          </div>
          <span className="text-sm text-muted">
            <b className="text-foreground">{avg.toFixed(1)}</b> จาก {reviews.length} รีวิว
          </span>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const planName = plans.find((p) => p.id === review.plan)?.name;

  return (
    <figure className="flex h-full flex-col rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex" aria-label={`ให้ ${review.rating} จาก 5 ดาว`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < review.rating ? "fill-brand text-brand" : "text-border"}`}
            aria-hidden
          />
        ))}
      </div>

      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted">
        {review.comment}
      </blockquote>

      <figcaption className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 font-display text-sm font-bold text-brand">
          {review.userName.charAt(0)}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-medium text-foreground">{review.userName}</span>
          {planName && <span className="block text-xs text-muted">สมาชิก{planName}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
