"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ReviewState = { ok?: boolean; error?: string };

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "กรอกชื่อที่ต้องการให้แสดงอย่างน้อย 2 ตัวอักษร")
    .max(40, "ชื่อยาวเกินไป"),
  rating: z.coerce.number().int().min(1, "เลือกคะแนน 1 ถึง 5 ดาว").max(5, "เลือกคะแนน 1 ถึง 5 ดาว"),
  comment: z
    .string()
    .trim()
    .min(20, "เขียนรีวิวอย่างน้อย 20 ตัวอักษร เพื่อให้เป็นประโยชน์กับคนอ่าน")
    .max(1000, "รีวิวยาวเกิน 1000 ตัวอักษร"),
});

/**
 * สมาชิกส่งรีวิวของตัวเอง — หนึ่งคนหนึ่งรีวิว ส่งซ้ำคือแก้ของเดิม
 * ทุกครั้งที่ส่งจะกลับไปสถานะรออนุมัติ เพื่อให้แอดมินตรวจก่อนขึ้นหน้าเว็บ
 */
export async function submitReview(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบก่อนส่งรีวิว" };

  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  // รับรีวิวเฉพาะคนที่เคยสมัครแพ็กเกจจริง เพื่อให้รีวิวบนเว็บเชื่อถือได้
  const hasSubscribed = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
    select: { planCode: true },
    orderBy: { createdAt: "desc" },
  });
  if (!hasSubscribed) {
    return { error: "รับรีวิวจากสมาชิกที่เคยสมัครแพ็กเกจแล้วเท่านั้น" };
  }

  const { displayName, rating, comment } = parsed.data;
  const existing = await prisma.review.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const data = {
    userName: displayName,
    rating,
    comment,
    plan: hasSubscribed.planCode,
    isApproved: false,
  };

  if (existing) {
    await prisma.review.update({ where: { id: existing.id }, data });
  } else {
    await prisma.review.create({ data: { ...data, userId: session.user.id } });
  }

  revalidatePath("/account/reviews");
  revalidatePath("/");
  return { ok: true };
}
