"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { salesPaused } from "@/config/site";
import { plansForUser } from "@/lib/pricing";
import { activateMembership } from "@/lib/lifecycle";
import { parseSlipDataUrl } from "@/lib/slip";
import { verifySlip, slipAutoApprove, slipVerifyEnabled } from "@/lib/slip-verify";
import { readSlipQr } from "@/lib/slip-qr";
import { formatTHB } from "@/lib/utils";
import { sendAdminAlert } from "@/lib/telegram";
import { approveOrderById } from "@/lib/approve-order";

/** สร้างออเดอร์ QR แล้วพาไปหน้าชำระเงิน */
export async function createQrOrder(formData: FormData) {
  // กันฝั่งเซิร์ฟเวอร์ด้วย ไม่ใช่แค่ซ่อนปุ่ม — server action เรียกตรงได้จากข้างนอก
  // ซ่อนปุ่มอย่างเดียวคือปิดแค่หน้าจอ ไม่ได้ปิดระบบจริง
  if (salesPaused) redirect("/#pricing");

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

/**
 * เปิดหน้าแนบสลิปให้คนที่ "โอนเงินมาแล้ว" ตอนที่ระบบหยุดรับชำระเงิน
 *
 * ทำไมต้องมีแยกจาก createQrOrder: ตอนหยุดรับเงิน createQrOrder เด้งกลับหน้าราคาเสมอ
 * คนที่โอนเงินมาก่อนหน้านั้นจึงสร้างออเดอร์ไม่ได้ และเมื่อไม่มีออเดอร์ก็ไม่มีหน้าให้
 * แนบสลิป วนกลับไปหน้าที่เขียนว่า "เปิดเร็ว ๆ นี้" ทุกครั้ง — เงินเข้าบัญชีเราแล้ว
 * แต่ระบบมองไม่เห็นว่าใครโอน (เกิดขึ้นจริง 29 ก.ย. 69 ลูกค้าโอน 08:38 แล้วหาที่แนบ
 * ไม่เจอจนต้องทักแอดมิน ซึ่งก็ไม่มีทางแก้ให้ได้)
 *
 * ตัวนี้ไม่ได้เปิดขายใหม่ — ไม่มีการแสดง QR ไม่มีการรับเงิน มีแต่การ "รับหลักฐาน"
 * ว่าเงินที่เข้ามาแล้วเป็นของใคร ซึ่งจำเป็นทั้งตอนเปิดสิทธิ์และตอนตามคืนเงิน
 * แอดมินยังเป็นคนกดอนุมัติเองทุกใบเหมือนเดิม
 */
export async function startSlipForTransfer(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const planCode = String(formData.get("planCode") ?? "");
  const userPlans = await plansForUser(session.user.id);
  const plan = userPlans.find((p) => p.id === planCode);
  if (!plan) redirect("/account/pay/transferred?error=plan");

  // ใบที่ยังไม่ได้แนบสลิปใช้ต่อได้ ไม่ต้องสร้างใหม่ทุกครั้งที่กด
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
          note: "ลูกค้าแจ้งว่าโอนมาแล้วระหว่างหยุดรับชำระเงิน",
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

  const who = session.user.name ?? session.user.email;
  const what = `${plan?.name ?? order.planCode} · ${formatTHB(order.amountTHB)}`;

  // ยอดตรงและเปิดอนุมัติอัตโนมัติไว้ = เปิดสิทธิ์ทันที ไม่ต้องรอแอดมิน
  if (verify.status === "VERIFIED" && slipAutoApprove) {
    await approveOrderById(order.id, "ตรวจสลิปอัตโนมัติ");

    /**
     * ต้องแจ้งตอน "สำเร็จ" ด้วย ไม่ใช่แจ้งเฉพาะตอนต้องให้คนตรวจ
     *
     * ของเดิมเงียบสนิทเมื่ออนุมัติอัตโนมัติผ่าน ซึ่งแปลว่าเจ้าของร้านจะไม่มีทางรู้เลย
     * ว่าระบบเปิดสิทธิ์ให้ใครไปบ้าง และถ้าตัวอ่านสลิปเพี้ยนจนอนุมัติผิด ก็จะไม่มี
     * อะไรฟ้องจนกว่าจะไปนั่งไล่ดูรายการเอง — เป็นความเงียบแบบเดียวกับที่ทำให้
     * อีเมลพังอยู่เป็นเดือนโดยไม่มีใครรู้
     *
     * ช่วงแรกที่เพิ่งเปิดระบบอัตโนมัติ ข้อความนี้คือตัวที่ทำให้ตรวจได้ว่า
     * "ระบบตัดสินถูกไหม" โดยไม่ต้องเฝ้าหน้าจอ
     */
    await sendAdminAlert(
      `✅ อนุมัติสลิปอัตโนมัติแล้ว
สมาชิก: ${who}
แพ็ก: ${what}
เลขอ้างอิงโอน: ${verify.transRef ?? "อ่านไม่ได้"}
ยอดที่อ่านได้: ${verify.amount !== undefined ? formatTHB(verify.amount) : "อ่านไม่ได้"}
ผ่านครบสามด่าน: ยอดตรง · เข้าบัญชีเราจริง · เป็นสลิปของออเดอร์นี้

เปิดสิทธิ์ให้แล้วโดยไม่ต้องรอใครกด — ถ้าเห็นว่าไม่ถูก รีบตรวจที่ ${base}/admin/orders`
    );

    revalidatePath(`/account/pay/${orderId}`);
    return { ok: true, note: "ตรวจสลิปอัตโนมัติผ่านแล้ว เปิดสิทธิ์ให้เรียบร้อย" };
  }

  /**
   * ไม่ผ่านอัตโนมัติ — บอกด้วยว่าทำไม และตอนนี้ระบบอยู่โหมดไหน
   *
   * "รอตรวจ" เฉย ๆ ไม่พอ เพราะเหตุผลต่างกันคนละเรื่อง เช่น "ผิดบัญชี" อาจแปลว่า
   * มีคนพยายามใช้สลิปที่โอนเข้าบัญชีคนอื่น ส่วน "อ่านสลิปไม่ได้" คือลูกค้าปกติ
   * ที่แค่ภาพไม่ชัด — สองอย่างนี้ต้องรีบไม่เท่ากัน
   */
  const mode = !slipVerifyEnabled
    ? "ยังไม่ได้เปิดระบบตรวจสลิปอัตโนมัติ"
    : slipAutoApprove
      ? "อนุมัติอัตโนมัติเปิดอยู่ แต่ใบนี้ไม่ผ่านด่านตรวจ"
      : "ระบบอ่านสลิปให้ แต่ยังตั้งไว้ว่าต้องกดอนุมัติเอง";

  await sendAdminAlert(
    `🧾 สลิปใหม่รอตรวจ
สมาชิก: ${who}
แพ็ก: ${what}
ผลตรวจอัตโนมัติ: ${verify.status} — ${verify.note}
โหมดตอนนี้: ${mode}
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

/**
 * บันทึกว่าคืนเงินให้ลูกค้ารายนี้แล้ว
 *
 * ไม่แตะ status เพราะ REJECTED หมายถึง "สลิปไม่ผ่านการตรวจ" คนละเรื่องกับคืนเงิน
 * และคืนเงินเกิดได้ทั้งตอนที่ยังไม่อนุมัติและตอนอนุมัติไปแล้ว
 *
 * ไม่ยกเลิกสิทธิ์ให้อัตโนมัติ ถึงจะคืนเงินคนที่ APPROVED ไปแล้ว — การตัดสิทธิ์
 * เป็นคนละการตัดสินใจ ทำเองได้ที่หน้าสมาชิก ถ้าทำอัตโนมัติแล้วแอดมินกดผิด
 * ลูกค้าจะโดนตัดสิทธิ์ทันทีโดยไม่ได้ตั้งใจ
 */
export async function markOrderRefunded(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  if (!id) return;

  const order = await prisma.slipOrder.findUnique({
    where: { id },
    select: { amountTHB: true, refundedAt: true },
  });
  if (!order) return;
  // กดซ้ำไม่ทับของเดิม — ไม่งั้นวันที่คืนเงินจริงหายไปกลายเป็นวันที่กดซ้ำ
  if (order.refundedAt) return;

  const typed = Number(formData.get("refundTHB"));
  const amount = Number.isFinite(typed) && typed > 0 ? Math.round(typed) : order.amountTHB;

  await prisma.slipOrder.update({
    where: { id },
    data: {
      refundedAt: new Date(),
      refundTHB: amount,
      refundedById: session.user.id,
      refundNote: String(formData.get("refundNote") ?? "").slice(0, 300) || null,
    },
  });
  revalidatePath("/admin/orders");
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
