import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // รูปสลิปจากมือถือมักใหญ่กว่าเพดาน default 1MB ของ Server Actions แล้วพังเป็น 413
    // ฝั่ง client บีบรูปก่อนส่งอยู่แล้ว (SlipUploadForm) ตัวนี้เป็น safety net เผื่อรูปที่บีบแล้วยังใหญ่
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // ภาพ snapshot กราฟจาก TradingView (ปุ่มกล้อง 📷 บนกราฟ)
    remotePatterns: [
      { protocol: "https", hostname: "s3.tradingview.com", pathname: "/snapshots/**" },
      { protocol: "https", hostname: "www.tradingview.com", pathname: "/x/**" },
    ],
  },
};

export default nextConfig;
