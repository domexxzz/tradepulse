import { Background3D } from "@/components/common/Background3D";
import { ProductCard } from "@/components/marketing/ProductCard";
import { getPromoState } from "@/lib/pricing";

/**
 * หน้าการ์ดเดี่ยว — มีไว้เปิดแล้วแคปหน้าจอเป็นภาพโฆษณา
 *
 * ไม่มี navbar/footer เพราะจะติดมาในภาพ และปิดปุ่ม CTA เพราะปุ่มในภาพนิ่งกดไม่ได้
 * ราคาบนการ์ดดึงจาก getPromoState ตัวเดียวกับหน้าราคา ภาพที่แคปไปโพสต์จึงตรงกับหน้าเว็บเสมอ
 *
 * noindex เพราะเนื้อหาซ้ำกับหน้าแรก ปล่อยให้ Google เก็บจะแย่งอันดับกันเอง
 */
export const metadata = {
  title: "การ์ดสรุป QVX",
  robots: { index: false, follow: false },
  alternates: { canonical: "/card" },
};

export const revalidate = 300;

export default async function CardPage() {
  const promo = await getPromoState();

  return (
    <>
      <Background3D />
      <main className="grid min-h-dvh place-items-center px-4 py-14">
        <ProductCard monthlyTHB={promo.monthlyTHB} showCta={false} eagerChart />
      </main>
    </>
  );
}
