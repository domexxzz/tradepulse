import { Background3D } from "@/components/common/Background3D";
import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { Hero } from "@/components/marketing/Hero";
import { MarketTicker } from "@/components/marketing/MarketTicker";
import { RealResults } from "@/components/marketing/RealResults";
import { LiveChart } from "@/components/marketing/LiveChart";
import { BacktestStats } from "@/components/marketing/BacktestStats";
import { ProofLedger } from "@/components/marketing/ProofLedger";
import { DecisionPath } from "@/components/marketing/DecisionPath";
import { ProductTour } from "@/components/marketing/ProductTour";
import { ProductWorkbench } from "@/components/marketing/ProductWorkbench";
import { FeatureExplorer } from "@/components/marketing/FeatureExplorer";
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
 * ลำดับของหน้าแรก — พิสูจน์ก่อน ค่อยเล่าว่ามีอะไร
 *
 *   เห็นของ      Hero + คลิปกราฟจริง + ราคาเริ่มต้น
 *   พิสูจน์      ชาร์ต 3 ชุด → กราฟจริง/ราคา live → สถิติ backtest
 *   กลไก        ปัญหา→ทางแก้ และ 3 ขั้นตอน (section เดียว)
 *   มีอะไรบ้าง   แผงสำรวจฟีเจอร์ทั้งหมด
 *   ใช้จริง      Telegram → ชุมชน
 *   ตัดสินใจ     รีวิว → ราคา → คำถาม → รับข่าวสาร → คำเตือน
 *
 * ⚠️ ทำไมหลักฐานถึงต้องมาก่อน:
 * ของเดิมวางเป็นแคตตาล็อก — Hero, ปัญหา, วิธีทำงาน, การ์ดฟีเจอร์ 12 ใบ รวม 5,500px
 * แรกเป็นคำอ้างล้วน ๆ กว่าจะเจอหลักฐานชิ้นแรกก็ผ่านครึ่งหน้าไปแล้ว และหน้าราคา
 * อยู่ที่ 75% ของหน้า คนขายอินดิเคเตอร์เจอคำถามแรกเสมอว่า "ของจริงไหม"
 * ลำดับนี้จึงตอบคำถามนั้นก่อน แล้วค่อยไปเรื่องว่ามีเครื่องมืออะไรบ้าง
 *
 * หมายเหตุ: BacktestStats และ Reviews คืน null อยู่ตอนนี้ (ยังไม่มีตัวเลขจริง
 * และยังไม่มีรีวิวที่อนุมัติในฐานข้อมูล) วางตำแหน่งไว้แล้วเพื่อให้โผล่เองเมื่อมีข้อมูล
 */

export default async function Home() {
  const promo = await getPromoState();
  return (
    <>
      <JsonLd data={homeJsonLd(promo.monthlyTHB)} />
      <Background3D />
      <Navbar />
      <main className="marketing-home">
        <Hero monthlyTHB={promo.monthlyTHB} />

        {/* หลักฐาน: ticker → ชาร์ต 3 ชุด → กราฟจริง */}
        <section id="proof" className="pb-10 sm:pb-12">
          <MarketTicker />
          <RealResults />
          <LiveChart />
          <BacktestStats />
          <ProofLedger />
          <ProductTour />
        </section>

        {/* กลไก */}
        <DecisionPath />

        {/* มีอะไรบ้าง */}
        <FeatureExplorer />

        {/* ทดลองชุดตั้งค่า + เหตุผลที่ workflow แตกต่าง */}
        <ProductWorkbench />

        {/* ใช้งานจริง: Telegram → ชุมชน */}
        <section id="use" className="border-y border-border bg-surface py-10 sm:py-12">
          <TelegramAlerts />
          <div className="container-x mt-8">
            <Community />
          </div>
        </section>

        {/* ตัดสินใจ */}
        <Reviews />
        <Pricing />
        <FAQ />
        {/* ปิดการตัดสินใจ: จดหมายข่าว + คำเตือน */}
        <section id="closing" className="py-14 sm:py-16">
          <EmailCapture />
          <Disclaimer />
        </section>
      </main>
      <Footer />
      <AdBanners promo={promo} />
      <ChatWidget />
    </>
  );
}
