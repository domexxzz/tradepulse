import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { allFeatures } from "@/config/features";

/**
 * แผนผังเว็บสำหรับ Search Engine
 * ใส่เฉพาะหน้า public — หน้า /account, /admin และ /api ไม่ควรถูกจัดทำดัชนี (ดู robots.ts)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const featurePages: MetadataRoute.Sitemap = allFeatures.map((f) => ({
    url: `${site.url}/features/${f.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...featurePages];
}
