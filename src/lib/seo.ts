/**
 * structured data ของหน้าแรก
 * แยกออกมาเพื่อให้เนื้อหา (ราคา/FAQ) มาจากไฟล์ config ชุดเดียวกับที่แสดงบนหน้าเว็บ
 * ถ้าประกาศราคาใน JSON-LD ไม่ตรงกับที่แสดงจริง Google ถือว่าเป็นข้อมูลหลอก
 */
import { site } from "@/config/site";
import { plansFor } from "@/config/plans";
import { faqs, allFeatures } from "@/config/features";

/**
 * @param monthlyTHB ราคารายเดือนที่หน้าเว็บแสดงอยู่ตอนนั้น (ช่วงโปรคือราคาโปร)
 *   ต้องส่งค่าเดียวกับที่ <Pricing> แสดง ไม่งั้น JSON-LD กับหน้าเว็บจะประกาศคนละราคา
 */
export function homeJsonLd(monthlyTHB: number): Record<string, unknown>[] {
  const plans = plansFor(monthlyTHB);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.fullName,
    url: site.url,
    description: site.description,
    ...(site.contact.email ? { email: site.contact.email } : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    inLanguage: "th-TH",
  };

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: site.fullName,
    description: site.description,
    category: "เครื่องมือวิเคราะห์กราฟ (TradingView Indicator)",
    brand: { "@type": "Brand", name: site.name },
    url: site.url,
    additionalProperty: allFeatures.map((f) => ({
      "@type": "PropertyValue",
      name: f.title,
      value: f.desc,
    })),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "THB",
      lowPrice: Math.min(...plans.map((p) => p.priceTHB)),
      highPrice: Math.max(...plans.map((p) => p.priceTHB)),
      offerCount: plans.length,
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.priceTHB,
        priceCurrency: "THB",
        url: `${site.url}/#pricing`,
        availability: "https://schema.org/InStock",
      })),
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return [organization, website, product, faqPage];
}
