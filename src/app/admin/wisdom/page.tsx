import { BrokerReviewQueue } from "@/components/admin/BrokerReviewQueue";

export const dynamic = "force-dynamic";

/** ฝั่งแอดมิน — สิทธิ์เต็มถูกกันไว้แล้วที่ /admin/layout.tsx (พาร์ตเนอร์ใช้ /partner แทน) */
export default function AdminWisdomPage() {
  return <BrokerReviewQueue />;
}
