import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/**
 * พื้นที่สมาชิกและแอดมินต้องไม่ถูกจัดทำดัชนี
 * (ถึงจะล็อกด้วย auth อยู่แล้ว แต่ไม่ควรให้ URL โผล่ในผลค้นหาตั้งแต่แรก)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api", "/reset-password", "/forgot-password"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
