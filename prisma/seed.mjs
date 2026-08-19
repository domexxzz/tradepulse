import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const plans = [
  { code: "MONTH", name: "รายเดือน", priceTHB: 990, interval: "month", sortOrder: 1 },
  { code: "Q3", name: "ราย 3 เดือน", priceTHB: 2670, interval: "3month", sortOrder: 2 },
  { code: "H6", name: "ราย 6 เดือน", priceTHB: 4740, interval: "6month", sortOrder: 3 },
  { code: "YEAR", name: "รายปี", priceTHB: 7990, interval: "year", sortOrder: 4 },
];

const reviews = [
  { userName: "ณัฐพงษ์ (ตัวอย่าง)", rating: 5, comment: "อินดิเคเตอร์ช่วยให้การเทรดเป็นระบบขึ้นมาก บอกโซนทำกำไรได้ดี", plan: "รายปี", isApproved: true },
  { userName: "สมพร (ตัวอย่าง)", rating: 5, comment: "ใช้งานง่าย ตี Zone แนวรับ-ต้านให้พร้อม มือใหม่ก็ตามได้", plan: "6 เดือน", isApproved: true },
  { userName: "ธีรภัทร (ตัวอย่าง)", rating: 4, comment: "สัญญาณไม่ Repaint ทำให้กล้าเข้าตามแผน", plan: "รายเดือน", isApproved: false },
];

for (const p of plans) {
  await prisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
}
for (const r of reviews) {
  const exists = await prisma.review.findFirst({ where: { userName: r.userName, comment: r.comment } });
  if (!exists) await prisma.review.create({ data: r });
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "demo@tradepulse.test")
  .split(",").map((s) => s.trim()).filter(Boolean);
for (const email of adminEmails) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log("promoted admin:", email);
  }
}

await prisma.$disconnect();
console.log("seed complete");
