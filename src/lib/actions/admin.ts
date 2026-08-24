"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function grantAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.accessGrant.update({
    where: { id },
    data: { status: "GRANTED", grantedAt: new Date(), revokedAt: null },
  });
  revalidatePath("/admin/access-queue");
  revalidatePath("/admin");
}

export async function revokeAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.accessGrant.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  revalidatePath("/admin/access-queue");
  revalidatePath("/admin");
}

export async function approveReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function unapproveReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.update({ where: { id }, data: { isApproved: false } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function deleteReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function grantTelegram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.telegramGrant.update({
    where: { id },
    data: { status: "ADDED", addedAt: new Date(), removedAt: null },
  });
  revalidatePath("/admin/telegram");
  revalidatePath("/admin");
}

export async function revokeTelegram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.telegramGrant.update({
    where: { id },
    data: { status: "REMOVED", removedAt: new Date() },
  });
  revalidatePath("/admin/telegram");
  revalidatePath("/admin");
}
