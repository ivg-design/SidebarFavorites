import type { Metadata } from "next";
import { Fraunces, Public_Sans, JetBrains_Mono } from "next/font/google";
import { CANONICAL_HOST, OG_IMAGE, toCanonicalUrl } from "@/lib/seo";
import { asset } from "@/lib/config";
import "./globals.css";
import "./sections-a.css";
import "./sections-b.css";
import "./changelog.css";

const fraunces = Fraunces({
  variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"],
  axes: ["opsz"], display: "swap",
});
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const TITLE = "SidebarFavorites: custom Finder sidebar icons for macOS";
const DESC = "Give the folders in Finder's sidebar the icons you want. Any SF Symbol or your own SVG, no extension, no daemon, no login item. Free, MIT, macOS 13+.";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s" },
  description: DESC,
  applicationName: "SidebarFavorites",
  authors: [{ name: "IVG Design" }],
  creator: "IVG Design",
  metadataBase: new URL(CANONICAL_HOST),
  alternates: { canonical: toCanonicalUrl("/") },
  icons: { icon: asset("/images/icon-64.png"), apple: asset("/images/icon-180.png") },
  openGraph: { title: TITLE, description: DESC, type: "website", url: toCanonicalUrl("/"), siteName: "SidebarFavorites", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG_IMAGE.url] },
  robots: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable} ${jetbrains.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
