import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { UpdatePopup } from "@/components/UpdatePopup";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { getBranding } from "@/lib/supabaseBranding";
import { getBrandingLogoSrc } from "@/lib/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Attendance Tracker",
    template: "%s | Attendance Tracker",
  },
  description: "PWA สำหรับบันทึกเวลาเข้า-ออกงาน พร้อมถ่ายรูปและบันทึกพิกัดลง Supabase",
  manifest: "/manifest.json",
  applicationName: "Attendance Tracker",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/maskable-icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/nextrack-192x192.png", sizes: "192x192", type: "image/png" }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Attendance Tracker",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Attendance Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // ✅ อนุญาตให้ zoom ได้ เพื่อลด touch delay
  userScalable: true, // ✅ เปิดให้ pinch zoom (ลบ 300ms delay)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2b6cff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getBranding();
  const brandingLogo = getBrandingLogoSrc(branding.logoPath, branding.updatedAt, null) ?? "";
  return (
    <html lang="th" className="bg-slate-50">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50 text-slate-900`}
        data-branding-logo={brandingLogo}
        data-branding-updated-at={branding.updatedAt}
      >
        <style dangerouslySetInnerHTML={{__html: `
          /* iOS Safari 100vh fix */
          :root {
            --viewport-height: 100vh;
          }
          @supports (-webkit-touch-callout: none) {
            :root {
              --viewport-height: -webkit-fill-available;
            }
          }
        `}} />
        <Providers>{children}</Providers>
        <UpdatePopup />
      </body>
    </html>
  );
}
