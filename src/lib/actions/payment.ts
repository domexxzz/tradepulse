"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { activateMembership } from "@/lib/lifecycle";
import { parseSlipDataUrl } from "@/lib/slip";
import { verifySlip, slipAutoApprove, slipVerifyEnabled } from "@/lib/slip-verify";
import { formatTHB } from "@/lib/utils";
import { sendAdminAlert } from "@/lib/telegram";

/** สร้างออเดอร์ QR แล้วพาไปหน้าชำระเงิน */
export async function createQrOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const planCode = String(formData.get("planCode") ?? "");
  const plan = plans.find((p) => p.id === planCode);
  if (!plan) redirect("/#pricing");

  // กดปุ่มซ้ำ ๆ ไม่ควรได้ออเดอร์ค้างเป็นสิบใบ — ใบที่ยังไม่ได้แนบสลิปใช้ต่อได้เลย
  const pending = await prisma.slipOrder.findFirst({
    where: { userId: session.user.id, planCode: plan.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const orderId =
    pending?.id ??
    (
      await prisma.slipOrder.create({
        data: {
          userId: session.user.id,
          planCode: plan.id,
          amountTHB: plan.priceTHB,
          status: "PENDING",
        },
        select: { id: true },
      })
    ).id;

  redirect(`/account/pay/${orderId}`);
}

export type SlipState = { ok?: boolean; error?: string; note?: string };

/**
 * สมาชิกแนบสลิป (base64 data URL)
 * ตรวจสามชั้น: ไฟล์ถูกต้อง -> ไม่ใช่สลิปที่เคยใช้แล้ว -> (ถ้าเปิดไว้) ให้ผู้ให้บริการอ่านยอด
 */
export async function submitSlip(_prev: SlipState, formData: FormData): Promise<SlipState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบ" };

  const orderId = String(formData.get("orderId") ?? "");
  const parsed = parseSlipDataUrl(String(formData.get("slip") ?? ""));
  if (!parsed.ok) return { error: parsed.error };

  const order = await prisma.slipOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.user.id) return { error: "ไม่พบออเดอร์" };
  if (order.status === "APPROVED") return { error: "ออเดอร์นี้อนุมัติไปแล้ว" };

  // สลิปรูปเดียวกันใช้ได้ครั้งเดียวทั้งระบบ
  const duplicate = await prisma.slipOrder.findFirst({
    where: { slipHash: parsed.slip.hash, NOT: { id: order.id } },
    select: { id: true },
  });
  if (duplicate) {
    await prisma.slipOrder.update({
      where: { id: order.id },
      data: { verifyStatus: "DUPLICATE", verifyNote: "สลิปนี้ถูกใช้กับออเดอร์อื่นแล้ว", verifiedAt: new Date() },
    });
    return { error: "สลิปนี้ถูกใช้ยืนยันการชำระเงินไปแล้ว กรุณาแนบสลิปของรายการนี้" };
  }

  const verify = await verifySlip({
    base64: parsed.slip.base64,
    mime: parsed.slip.mime,
    expectAmountTHB: order.amountTHB,
  });

  // เลขอ้างอิงซ้ำ = สลิปเดิมถ่ายรูปใหม่มาส่ง
  if (verify.transRef) {
    const usedRef = await prisma.slipOrder.findFirst({
      where: { transRef: verify.transRef, NOT: { id: order.id } },
      select: { id: true },
    });
    if (usedRef) {
      await prisma.slipOrder.update({
        where: { id: order.id },
        data: { verifyStatus: "DUPLICATE", verifyNote: "เลขอ้างอิงรายการโอนนี้ถูกใช้แล้ว", verifiedAt: new Date() },
      });
      return { error: "รายการโอนนี้ถูกใช้ยืนยันการชำระเงินไปแล้ว" };
    }
  }

  await prisma.slipOrder.update({
    where: { id: order.id },
    data: {
      slipData: `data:${parsed.slip.mime};base64,${parsed.slip.base64}`,
      slipMime: parsed.slip.mime,
      slipHash: parsed.slip.hash,
      status: "SUBMITTED",
      transRef: verify.transRef ?? null,
      verifyStatus: verify.status,
      verifyNote: verify.note,
      verifiedAt: slipVerifyEnabled ? new Date() : null,
    },
  });

  const plan = plans.find((p) => p.id === order.planCode);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // ยอดตรงและเปิดอนุมัติอัตโนมัติไว้ = เปิดสิทธิ์ทันที ไม่ต้องรอแอดมิน
  if (verify.status === "VERIFIED" && slipAutoApprove) {
    await approveOrderById(order.id, "ตรวจสลิปอัตโนมัติ");
    revalidatePath(`/account/pay/${orderId}`);
    return { ok: true, note: "ตรวจสลิปอัตโนมัติผ่านแล้ว เปิดสิทธิ์ให้เรียบร้อย" };
  }

  await sendAdminAlert(
    `🧾 สลิปใหม่รอตรวจ
สมาชิก: ${session.user.name ?? session.user.email}
แพ็ก: ${plan?.name ?? order.planCode} · ${formatTHB(order.amountTHB)}
ผลตรวจอัตโนมัติ: ${verify.status} — ${verify.note}
ตรวจที่: ${base}/admin/orders`
  );

  revalidatePath(`/account/pay/${orderId}`);
  return {
    ok: true,
    note:
      verify.status === "MISMATCH"
        ? "ได้รับสลิปแล้ว แต่ระบบอ่านยอดไม่ตรงกับออเดอร์ ทีมงานจะตรวจสอบให้อีกครั้ง"
        : undefined,
  };
}

/**
 * เปิดสิทธิ์จากออเดอร์ที่ชำระแล้ว (ใช้ทั้งตอนแอดมินกดและตอนตรวจสลิปอัตโนมัติ)
 * เขียนสถานะ APPROVED ก่อนเปิดสิทธิ์ไม่ได้ เพราะถ้าเปิดสิทธิ์ล้มจะได้ออเดอร์ที่ปิดไปแล้วแต่ไม่ได้ของ
 */
async function approveOrderById(orderId: string, source: string): Promise<void> {
  const order = await prisma.slipOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status === "APPROVED") return;

  await activateMembership({
    userId: order.userId,
    planCode: order.planCode,
    amountTHB: order.amountTHB,
    providerRef: `slip_${order.id}`,
    provider: "web",
    source,
  });

  await prisma.slipOrder.update({
    where: { id: order.id },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
}

/** แอดมินอนุมัติ -> เปิด/ต่ออายุแพ็กเกจ + เปิดสิทธิ์ทุกช่องทาง */
export async function approveOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  if (!id) return;

  await approveOrderById(id, "แอดมินอนุมัติสลิป");

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function rejectOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  if (!id) return;

  await prisma.slipOrder.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      note: String(formData.get("reason") ?? "").slice(0, 300) || null,
    },
  });
  revalidatePath("/admin/orders");
}
