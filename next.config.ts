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
    /**
     * ย่อรูปทีละภาพ (ค่าเริ่มต้น = จำนวน CPU) — บน Render เครื่อง 512 MB
     * หน้าแรกมีรูปกว่า 160 ภาพ คนเปิดพร้อมกันไม่กี่คนก็ย่อพร้อมกันหลายสิบภาพ
     * แล้วเครื่องโดนปิดเพราะหน่วยความจำเกิน (OOM 3 ครั้งใน 3 นาที 20 ต.ค. 69 รูปพังทั้งหน้า)
     */
    imgOptConcurrency: 1,
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
     * WebP อย่างเดียว (เดิมเสิร์ฟ AVIF ก่อนตอนอยู่ Vercel ซึ่งย่อรูปบนเครื่องของ Vercel เอง)
     * ย้ายมา Render แล้ว เว็บย่อรูปเองบนเครื่อง 512 MB — การเข้ารหัส AVIF ใช้หน่วยความจำ
     * และ CPU หนักกว่า WebP หลายเท่า เป็นตัวหลักที่ทำให้เครื่องโดน OOM (20 ต.ค. 69)
     * ไฟล์ต้นทางเป็น WebP คุณภาพ 80 อยู่แล้ว ภาพที่ได้ต่างจาก AVIF น้อยมาก
     */
    formats: ["image/webp"],
    // แคชรูปที่ย่อแล้วไว้ 30 วัน (ค่าเริ่มต้น 4 ชม.) — ลดการย่อซ้ำ ซึ่งคือตัวกินหน่วยความจำ
    minimumCacheTTL: 2592000,
    // ภาพ snapshot กราฟจาก TradingView (ปุ่มกล้อง 📷 บนกราฟ)
    remotePatterns: [
      { protocol: "https", hostname: "s3.tradingview.com", pathname: "/snapshots/**" },
      { protocol: "https", hostname: "www.tradingview.com", pathname: "/x/**" },
    ],
  },
};

export default nextConfig;
