"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { plansForUser } from "@/lib/pricing";
import { activateMembership } from "@/lib/lifecycle";
import { parseSlipDataUrl } from "@/lib/slip";
import { verifySlip, slipAutoApprove, slipVerifyEnabled } from "@/lib/slip-verify";
import { readSlipQr } from "@/lib/slip-qr";
import { formatTHB } from "@/lib/utils";
import { sendAdminAlert } from "@/lib/telegram";

/** สร้างออเดอร์ QR แล้วพาไปหน้าชำระเงิน */
export async function createQrOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const planCode = String(formData.get("planCode") ?? "");
  // ราคาต้องคิดจากของผู้ใช้คนนี้ ไม่ใช่แคตตาล็อกกลาง
  // สมาชิกโปร 300 คนแรกถูกล็อกราคาไว้ ส่วนคนใหม่ได้ราคาปัจจุบัน
  const userPlans = await plansForUser(session.user.id);
  const plan = userPlans.find((p) => p.id === planCode);
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
/**
 * ต่อท้ายผลอ่าน QR ให้แอดมินเห็นในหน้าตรวจสลิป
 * "อ่าน QR ไม่ได้" ไม่ใช่ความผิดปกติ (บางธนาคารไม่ฝัง QR / ภาพครอปมาแล้ว)
 * แต่แอดมินควรรู้ว่าใบนี้ระบบกันซ้ำได้ในระดับไหน
 */
function qrNote(base: string, qr: { found: boolean; ref?: string }): string {
  const tail = qr.found
    ? qr.ref
      ? `· QR: ${qr.ref}`
      : "· อ่าน QR ได้"
    : "· ไม่พบ QR ในสลิป (กันซ้ำด้วยไฟล์รูปเท่านั้น)";
  return base ? `${base} ${tail}` : tail;
}

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

  // ชั้นที่สอง: QR ที่ธนาคารฝังในสลิป — ผูกกับ "รายการโอน" ไม่ใช่ "ไฟล์รูป"
  // จึงจับได้แม้ถ่ายรูปสลิปเดิมใหม่หรือครอปใหม่ ซึ่ง sha256 ด้านบนจับไม่ได้
  // อ่านในเครื่องเราเอง ไม่ต้องพึ่งบริการภายนอก จึงทำงานเสมอโดยไม่มีค่าใช้จ่าย
  const qr = await readSlipQr(parsed.slip.base64);
  if (qr.found && qr.payload) {
    const usedQr = await prisma.slipOrder.findFirst({
      where: { transRef: qr.payload, NOT: { id: order.id } },
      select: { id: true },
    });
    if (usedQr) {
      await prisma.slipOrder.update({
        where: { id: order.id },
        data: {
          verifyStatus: "DUPLICATE",
          verifyNote: "รายการโอนนี้ถูกใช้ไปแล้ว (ตรวจจาก QR ในสลิป)",
          verifiedAt: new Date(),
        },
      });
      return { error: "รายการโอนนี้ถูกใช้ยืนยันการชำระเงินไปแล้ว กรุณาแนบสลิปของรายการนี้" };
    }
  }

  const verify = await verifySlip({
    base64: parsed.slip.base64,
    mime: parsed.slip.mime,
    expectAmountTHB: order.amountTHB,
    orderCreatedAt: order.createdAt,
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
      // เลขจากบริการตรวจสลิปดีที่สุดถ้ามี แต่ไม่มีก็ใช้ QR แทนได้
      // ต้องเก็บลงคอลัมน์เดียวกัน ไม่งั้นรอบหน้าไม่มีอะไรให้เทียบ
      transRef: verify.transRef ?? qr.payload ?? null,
      verifyStatus: verify.status,
      verifyNote: qrNote(verify.note, qr),
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
  revalidatePath("/"); // ตัวนับที่นั่งโปรบนหน้าแรกต้องลดทันที
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
