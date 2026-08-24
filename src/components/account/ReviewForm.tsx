"use client";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview, type ReviewState } from "@/lib/actions/review";

const MAX_COMMENT = 1000;

export function ReviewForm({
  defaultName,
  current,
}: {
  defaultName: string;
  current: { rating: number; comment: string; isApproved: boolean } | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const [rating, setRating] = useState(current?.rating ?? 5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(current?.comment ?? "");

  const shown = hover || rating;

  return (
    <form action={action} className="card-surface space-y-5 rounded-2xl p-6">
      {state.error && (
        <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-up/30 bg-up/10 px-3.5 py-2.5 text-sm text-up">
          ส่งรีวิวเรียบร้อย ทีมงานจะตรวจก่อนขึ้นแสดงบนหน้าเว็บ
        </div>
      )}

      <div>
        <span className="mb-2 block text-sm font-medium">ให้คะแนน</span>
        <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} ดาว`}
              aria-pressed={rating === n}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 ${n <= shown ? "fill-brand text-brand" : "text-border"}`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted">{shown} / 5</span>
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">ชื่อที่จะแสดงบนเว็บ</span>
        <input
          name="displayName"
          defaultValue={defaultName}
          maxLength={40}
          placeholder="เช่น สมชาย ท. หรือ ชื่อเล่น"
          className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
        <span className="mt-1 block text-xs text-muted">
          ไม่ต้องใช้ชื่อจริงเต็มก็ได้ เราจะไม่แสดงอีเมลของคุณ
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">รีวิวของคุณ</span>
        <textarea
          name="comment"
          rows={5}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="ใช้แล้วเป็นยังไงบ้าง ฟีเจอร์ไหนช่วยได้จริง เล่าตามที่เจอมาเลยครับ"
          className="w-full resize-y rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand/60"
        />
        <span className="mt-1 block text-right text-xs text-muted">
          {comment.trim().length} / {MAX_COMMENT}
        </span>
      </label>

      <button
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-background transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : current ? "อัปเดตรีวิว" : "ส่งรีวิว"}
      </button>

      {current && (
        <p className="text-center text-xs text-muted">
          การแก้ไขจะกลับไปสถานะรออนุมัติอีกครั้ง
        </p>
      )}
    </form>
  );
}
