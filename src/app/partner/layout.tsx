import { requireBrokerReviewer } from "@/lib/admin";
import { PortalShell } from "@/components/portal/PortalShell";
import { PartnerSidebar } from "@/components/admin/PartnerSidebar";

/**
 * พื้นที่ของพาร์ตเนอร์โบรก — แยกจาก /admin โดยตั้งใจ
 *
 * /admin/layout.tsx กันด้วย requireAdmin ทั้งชั้น ถ้าปล่อยให้พาร์ตเนอร์เข้าไปได้
 * เขาจะเห็นทุกหน้าในนั้น (สลิป การเงิน สมาชิกทั้งหมด แก้ราคา) ซึ่งเกินงานที่เขาต้องทำ
 * ที่นี่จึงมีหน้าเดียวคือคิวคำขอโบรก
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBrokerReviewer();
  return (
    <PortalShell
      badge="PARTNER"
      profile={{ name: session.user.name ?? session.user.email ?? "", isMember: false, daysLeft: null }}
      sidebar={<PartnerSidebar />}
    >
      {children}
    </PortalShell>
  );
}
