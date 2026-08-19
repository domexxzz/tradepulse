import type { Metadata } from "next";
import { Noto_Sans_Thai, Kanit } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-sans-thai",
  display: "swap",
});

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.fullName} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: ["อินดิเคเตอร์ทองคำ", "XAUUSD", "TradingView", "สัญญาณเทรด", "Forex", "เทรดทอง"],
  openGraph: {
    title: `${site.fullName} | ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    locale: "th_TH",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoThai.variable} ${kanit.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
