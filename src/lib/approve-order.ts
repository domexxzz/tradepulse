import { prisma } from "@/lib/prisma";
import { activateMembership } from "@/lib/lifecycle";

/**
 * เปิดสิทธิ์จากออเดอร์ที่ชำระแล้ว
 *
 * แยกออกมาจาก lib/actions/payment.ts เพราะไฟล์นั้นเป็น "use server"
 * ทุก export ในนั้นกลายเป็น server action ที่เรียกจากเบราว์เซอร์ได้
 * ซึ่งไม่ควรเป็นแบบนั้นกับฟังก์ชันที่เปิดสิทธิ์ให้สมาชิกโดยไม่ตรวจสิทธิ์ผู้เรียก
 * (เหตุผลเดียวกับที่ notifyAccessGranted ต้องอยู่ใน lib/access-notify.ts)
 *
 * เรียกจากสามที่: แอดมินกดอนุมัติ · ตรวจสลิปอัตโนมัติ · ช่องทางดูแลระบบ
 * ผู้เรียกทุกทางต้องตรวจสิทธิ์เองก่อน ฟังก์ชันนี้ไม่ตรวจให้
 *
 * เขียนสถานะ APPROVED ก่อนเปิดสิทธิ์ไม่ได้ เพราะถ้าเปิดสิทธิ์ล้ม
 * จะได้ออเดอร์ที่ปิดไปแล้วแต่ลูกค้าไม่ได้ของ
 */
export async function approveOrderById(orderId: string, source: string): Promise<void> {
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
