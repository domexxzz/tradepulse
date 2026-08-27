import { Background3D } from "@/components/common/Background3D";
import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { Hero } from "@/components/marketing/Hero";
import { MarketTicker } from "@/components/marketing/MarketTicker";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { CoreFeatures } from "@/components/marketing/CoreFeatures";
import { RealResults } from "@/components/marketing/RealResults";
import { BacktestStats } from "@/components/marketing/BacktestStats";
import { TelegramAlerts } from "@/components/marketing/TelegramAlerts";
import { Community } from "@/components/marketing/Community";
import { Reviews } from "@/components/marketing/Reviews";
import { Pricing } from "@/components/marketing/Pricing";
import { FAQ } from "@/components/marketing/FAQ";
import { EmailCapture } from "@/components/marketing/EmailCapture";
import { Disclaimer } from "@/components/marketing/Disclaimer";
import { AdBanners } from "@/components/marketing/AdBanners";
import { ChatWidget } from "@/components/marketing/ChatWidget";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo";
import { getPromoState } from "@/lib/pricing";

export const metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 300;

/**
 * ลำดับของหน้าแรก — เล่าเป็นเรื่องเดียว ไม่ใช่กองรวมกัน
 *
 *   เห็นของ (Hero + กราฟจริง)
 *   → ราคาวิ่งอยู่จริง (ticker)
 *   → ทำไมต้องใช้ (ปัญหา → วิธีแก้ → ใช้ยังไง)
 *   → มีอะไรบ้าง (ฟีเจอร์หลัก → เครื่องมือเสริม)
 *   → พิสูจน์ (กราฟสด → คลิป → สัญญาณเข้า Telegram → สัญญาณสด)
 *   → คนอื่นว่าไง (ชุมชน → รีวิว)
 *   → ตัดสินใจ (ราคา → คำถาม → รับข่าวสาร)
 *
 * ตัดออกไป 4 อัน: การ์ดกราฟข้อมูลสมมติ, เดโมที่ซ้ำกับกราฟสด,
 * แถบจุดเด่น (ย้ายไปอยู่ใน Hero) และรายการสิทธิประโยชน์ที่ซ้ำกับหน้าราคา
 */

export default async function Home() {
  const promo = await getPromoState();
  return (
    <>
      <JsonLd data={homeJsonLd(promo.monthlyTHB)} />
      <Background3D />
      <Navbar />
      <main>
        <Hero monthlyTHB={promo.monthlyTHB} />
        <MarketTicker />

        {/* ปูปัญหาให้ก่อน แล้วค่อยเข้าฟีเจอร์ */}
        <ProblemSolution />

        {/* ---- ลำดับ 5 หัวข้อนี้ต้องตรงกับเมนูใน config/site.ts เสมอ ----
             ฟีเจอร์ -> ตัวอย่างการทำงาน -> ราคา -> วิธีการใช้งาน -> FAQ
             ถ้าย้าย section ใดใน main อย่าลืมย้ายเมนูให้ตรงกันด้วย
             ไม่งั้นคนกดเมนูแล้วกระโดดข้ามไปข้ามมา */}
        <CoreFeatures />
        <RealResults />

        {/* หัวข้อประกอบ ไม่มีในเมนู วางคั่นก่อนถึงหน้าราคา */}
        <TelegramAlerts />
        <BacktestStats />
        <Reviews />

        <Pricing />
        <HowItWorks />
        <FAQ />

        {/* ปิดท้าย: ชวนรับข่าวสาร แล้วต่อด้วยชุมชนเป็นทางเลือกฟรี
            สำหรับคนที่ยังไม่พร้อมสมัคร */}
        <EmailCapture />
        <Community />
        <Disclaimer />
      </main>
      <Footer />
      <AdBanners promo={promo} />
      <ChatWidget />
    </>
  );
}
