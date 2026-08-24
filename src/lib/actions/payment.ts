"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { recordPayment, ensureAccessGrant, ensureTelegramGrant, ensureDiscordRole } from "@/lib/fulfillment";
import { formatTHB } from "@/lib/utils";
import { sendAdminAlert } from "@/lib/telegram";

/** สร้างออเดอร์ QR แล้วพาไปหน้าชำระเงิน */
export async function createQrOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const planCode = String(formData.get("planCode") ?? "");
  const plan = plans.find((p) => p.id === planCode);
  if (!plan) redirect("/#pricing");

  const order = await prisma.slipOrder.create({
    data: { userId: session!.user.id, planCode: plan.id, amountTHB: plan.priceTHB, status: "PENDING" },
  });
  redirect(`/account/pay/${order.id}`);
}

export type SlipState = { ok?: boolean; error?: string };

/** อัปโหลดสลิป (base64 data URL) */
export async function submitSlip(_prev: SlipState, formData: FormData): Promise<SlipState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบ" };

  const orderId = String(formData.get("orderId") ?? "");
  const slip = String(formData.get("slip") ?? "");
  if (!slip.startsWith("data:image/")) return { error: "กรุณาแนบรูปสลิป" };
  if (slip.length > 4_000_000) return { error: "ไฟล์ใหญ่เกินไป (ไม่เกิน ~3MB)" };

  const order = await prisma.slipOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.user.id) return { error: "ไม่พบออเดอร์" };

  await prisma.slipOrder.update({
    where: { id: orderId },
    data: { slipData: slip, status: "SUBMITTED" },
  });

  const plan = plans.find((p) => p.id === order.planCode);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await sendAdminAlert(
    `🧾 สลิปใหม่รอตรวจ
สมาชิก: ${session.user.name ?? session.user.email}
แพ็ก: ${plan?.name ?? order.planCode} · ${formatTHB(order.amountTHB)}
ตรวจที่: ${base}/admin/orders`
  );
  revalidatePath(`/account/pay/${orderId}`);
  return { ok: true };
}

/** แอดมินอนุมัติ -> เปิด subscription + สิทธิ์ */
export async function approveOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  const order = await prisma.slipOrder.findUnique({ where: { id } });
  if (!order || order.status === "APPROVED") return;

  const plan = plans.find((p) => p.id === order.planCode);
  const months = plan?.months ?? 1;
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  await prisma.subscription.create({
    data: { userId: order.userId, planCode: order.planCode, status: "ACTIVE", currentPeriodEnd: end },
  });
  await recordPayment(order.userId, order.amountTHB, `slip_${order.id}`);
  await ensureAccessGrant(order.userId);
  await ensureTelegramGrant(order.userId);
  await ensureDiscordRole(order.userId, order.planCode);
  await prisma.slipOrder.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date() } });

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function rejectOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  await prisma.slipOrder.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  revalidatePath("/admin/orders");
}
