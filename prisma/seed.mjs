import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const plans = [
  { code: "MONTH", name: "รายเดือน", priceTHB: 1290, interval: "month", sortOrder: 1 },
  { code: "Q3", name: "ราย 3 เดือน", priceTHB: 3870, interval: "3month", sortOrder: 2 },
  { code: "H6", name: "ราย 6 เดือน", priceTHB: 7740, interval: "6month", sortOrder: 3 },
  { code: "YEAR", name: "รายปี", priceTHB: 15480, interval: "year", sortOrder: 4 },
];

/**
 * รีวิวตัวอย่างสำหรับดูหน้าตา UI ตอนพัฒนาเท่านั้น
 *
 * ไม่สร้างให้โดยอัตโนมัติ และถ้าสร้างก็ยังไม่อนุมัติ (isApproved: false)
 * เพราะเว็บนี้ประกาศไว้ชัดว่ารีวิวทุกอันมาจากสมาชิกจริง — ขึ้นรีวิวปลอมบน production
 * คือโฆษณาเกินจริงตาม พ.ร.บ.คุ้มครองผู้บริโภค ไม่ใช่แค่เรื่องมารยาท
 *
 * อยากเห็นตอน dev: SEED_SAMPLE_REVIEWS=true node prisma/seed.mjs แล้วไปกดอนุมัติเองใน /admin/reviews
 */
const sampleReviews = [
  { userName: "ณัฐพงษ์ (ตัวอย่าง)", rating: 5, comment: "อินดิเคเตอร์ช่วยให้การเทรดเป็นระบบขึ้นมาก บอกโซนทำกำไรได้ดี", plan: "YEAR", isApproved: false },
  { userName: "สมพร (ตัวอย่าง)", rating: 5, comment: "ใช้งานง่าย ตี Zone แนวรับ-ต้านให้พร้อม มือใหม่ก็ตามได้", plan: "H6", isApproved: false },
  { userName: "ธีรภัทร (ตัวอย่าง)", rating: 4, comment: "สัญญาณไม่ Repaint ทำให้กล้าเข้าตามแผน", plan: "MONTH", isApproved: false },
];

for (const p of plans) {
  await prisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
}
if (process.env.SEED_SAMPLE_REVIEWS === "true") {
  for (const r of sampleReviews) {
    const exists = await prisma.review.findFirst({ where: { userName: r.userName, comment: r.comment } });
    if (!exists) await prisma.review.create({ data: r });
  }
  console.log("seeded sample reviews (ยังไม่อนุมัติ — อนุมัติเองที่ /admin/reviews)");
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "demo@qvx.test")
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
