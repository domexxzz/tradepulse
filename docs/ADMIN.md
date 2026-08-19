# Admin Dashboard (เฟส 4)

## เข้าใช้งาน
- URL: `/admin` (เข้าได้เฉพาะผู้ใช้ role = ADMIN)
- ผู้ใช้ทั่วไปที่เข้า `/admin` จะถูกส่งกลับ `/account`

## ตั้งผู้ใช้เป็นแอดมิน
1. ผู้ใช้สมัครสมาชิกปกติก่อน (`/register`)
2. ตั้ง env `ADMIN_EMAILS` (คั่นด้วย comma) แล้วรัน:
   ```bash
   npx prisma db seed
   ```
   หรือแก้ role ตรง ๆ ใน DB (`npx prisma studio`)
3. **สำคัญ:** ผู้ใช้ต้อง **ออกจากระบบแล้วเข้าใหม่** เพราะ role ถูกฝังใน JWT ตอน sign-in
   (jwt callback ดึง role จาก DB เฉพาะตอนล็อกอิน — ดู `src/auth.ts`)

## หน้าต่าง ๆ
| หน้า | ทำอะไร |
|---|---|
| `/admin` | แดชบอร์ด: สมาชิก, แพ็คเกจ active, คิวรออนุมัติ, รายได้รวม |
| `/admin/access-queue` | อนุมัติ/ยกเลิกสิทธิ์ TradingView (คิว AccessGrant) |
| `/admin/members` | รายชื่อสมาชิก + สถานะแพ็คเกจ + role |
| `/admin/reviews` | อนุมัติ / ซ่อน / ลบ รีวิว |
| `/admin/plans` | ดู Plan ใน DB + Stripe Price ID |

## ขั้นตอนส่งมอบสินค้า (สำคัญ)
เมื่อสมาชิกจ่ายเงินสำเร็จ → webhook สร้าง AccessGrant สถานะ PENDING อัตโนมัติ
1. แอดมินเปิด `/admin/access-queue`
2. ดู TradingView username ของสมาชิก
3. ไปเพิ่ม username นั้นในสคริปต์ invite-only บน TradingView (ทำเองในเว็บ TradingView)
4. กลับมากด **อนุมัติ** ในคิว → สถานะเป็น GRANTED
5. เมื่อสมาชิกหมดอายุ/ยกเลิก → กด **ยกเลิก** + ลบสิทธิ์ใน TradingView
