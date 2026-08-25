import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * ภาพพรีวิวตอนแชร์ลิงก์ (Facebook, LINE, X)
 *
 * ใช้ข้อความอังกฤษล้วน — ฟอนต์ค่าเริ่มต้นของ ImageResponse ไม่มีสระและวรรณยุกต์ไทย
 * ถ้าใส่ภาษาไทยจะออกมาเป็นกล่องสี่เหลี่ยม (ต้องแนบไฟล์ฟอนต์ไทยเองถึงจะใช้ได้)
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #08100b 0%, #101a12 55%, #0d2413 100%)",
          color: "#f3f7f1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              background: "#65e62c",
              color: "#08100b",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            {site.name.charAt(0)}
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>{site.name}</div>
        </div>

        <div style={{ marginTop: 44, fontSize: 66, fontWeight: 700, lineHeight: 1.15, maxWidth: 900 }}>
          XAUUSD Analysis Indicator
        </div>

        <div style={{ marginTop: 24, fontSize: 32, color: "#91a095", maxWidth: 860, lineHeight: 1.4 }}>
          Trend · Buy/Sell Signal · Entry · TP/SL · Risk Management — all in one TradingView tool
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#65e62c" }}>
          <div style={{ width: 40, height: 4, background: "#65e62c", borderRadius: 4 }} />
          {site.url.replace(/^https?:\/\//, "")}
        </div>
      </div>
    ),
    size
  );
}
