import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // ภาพ snapshot กราฟจาก TradingView (ปุ่มกล้อง 📷 บนกราฟ)
    remotePatterns: [
      { protocol: "https", hostname: "s3.tradingview.com", pathname: "/snapshots/**" },
      { protocol: "https", hostname: "www.tradingview.com", pathname: "/x/**" },
    ],
  },
};

export default nextConfig;
