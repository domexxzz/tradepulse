import { prisma } from "@/lib/prisma";

const ACTIVE = ["ACTIVE", "TRIALING"];

/** ดึง subscription ล่าสุดของผู้ใช้ + บอกว่ากำลังใช้งานอยู่ไหม */
export async function getUserSubscription(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const isActive = !!sub && ACTIVE.includes(sub.status);
  return { sub, isActive };
}
