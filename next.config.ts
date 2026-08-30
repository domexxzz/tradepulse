import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Security header พื้นฐาน — ของเดิมมีแต่ HSTS ที่ Vercel ใส่ให้เอง
   *
   * frame-ancestors คือตัวที่จำเป็นที่สุด: หน้าแอดมินมีปุ่มกดครั้งเดียวแล้วมีผลจริง
   * (อนุมัติออเดอร์ = แจกสิทธิ์ฟรี, ถอนสิทธิ์, ลบรีวิว) ถ้าฝัง iframe ได้
   * คนร้ายเอาหน้าแอดมินไปซ้อนใต้ปุ่มปลอมบนเว็บตัวเอง แล้วหลอกให้แอดมิน
   * ที่ล็อกอินค้างอยู่กดโดยไม่รู้ว่ากำลังกดอะไร
   *
   * ใส่ทั้ง X-Frame-Options และ CSP frame-ancestors เพราะเบราว์เซอร์เก่าอ่านตัวแรก
   * ตัวใหม่อ่านตัวหลัง — CSP ตัวนี้จำกัดแค่การถูกฝัง ไม่แตะสคริปต์หรือสไตล์
   * จึงไม่เสี่ยงทำหน้าเว็บพังแบบ CSP เต็มรูปแบบ
   *
   * nosniff กันเบราว์เซอร์เดาชนิดไฟล์เอง — สำคัญกับ /api/admin/slip/[id]
   * ที่เสิร์ฟไบต์จากไฟล์ที่ลูกค้าอัปโหลดเข้าเซสชันของแอดมิน
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  experimental: {
    // รูปสลิปจากมือถือมักใหญ่กว่าเพดาน default 1MB ของ Server Actions แล้วพังเป็น 413
    // ฝั่ง client บีบรูปก่อนส่งอยู่แล้ว (SlipUploadForm) ตัวนี้เป็น safety net เผื่อรูปที่บีบแล้วยังใหญ่
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    /**
     * Next 16 บังคับให้ประกาศค่า quality ที่อนุญาตไว้ก่อน ไม่งั้น optimizer ตอบ 400
     * (กันคนยิง URL สุ่มค่า quality เพื่อให้เซิร์ฟเวอร์ประมวลผลทิ้ง)
     * 75 = ค่าเริ่มต้นของทุกภาพ · 90 = screenshot กราฟในหน้า /features/[slug]
     * ซึ่งเป็นตัวหนังสือเส้นบางบนพื้นเข้ม จุดที่ ringing ของ 75 เห็นชัดที่สุด
     * และไฟล์ต้นทางผ่าน libwebp -quality 80 มาแล้วรอบหนึ่ง ไม่ควรบีบซ้ำหนักกว่านั้น
     */
    qualities: [75, 90],
    /**
     * เสิร์ฟ AVIF ก่อน แล้วถอยไป WebP ถ้าเบราว์เซอร์ไม่รองรับ (ค่าเริ่มต้นของ Next มีแค่ WebP)
     * ที่ขนาดไฟล์เท่ากัน AVIF เก็บรายละเอียดเส้นบางบนพื้นเข้มได้ดีกว่า WebP ชัดเจน
     * ซึ่งตรงกับลักษณะของ screenshot กราฟทุกภาพในเว็บนี้
     * แลกด้วยเวลาเข้ารหัสที่นานกว่า แต่ Next แคชผลไว้ใช้ซ้ำ จึงจ่ายแค่ครั้งแรก
     */
    formats: ["image/avif", "image/webp"],
    // ภาพ snapshot กราฟจาก TradingView (ปุ่มกล้อง 📷 บนกราฟ)
    remotePatterns: [
      { protocol: "https", hostname: "s3.tradingview.com", pathname: "/snapshots/**" },
      { protocol: "https", hostname: "www.tradingview.com", pathname: "/x/**" },
    ],
  },
};

export default nextConfig;
