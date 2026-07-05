import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://goldcompass.app";

// Cloudflare Web Analytics beacon token (public, inlined at build time). Unset
// = no analytics script is emitted, so dev/CI stay clean.
const cfBeaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

// Google Search Console meta-tag verification (alternative to DNS TXT).
const googleSiteVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GoldCompass — Smart Gold Investing Guidance",
    template: "%s · GoldCompass",
  },
  description:
    "GoldCompass helps everyday investors navigate the gold market with clear outlooks, live price trends, a smart gold calculator, and market insights.",
  applicationName: "GoldCompass",
  keywords: [
    "gold investing",
    "gold price",
    "XAU/USD",
    "gold calculator",
    "gold market outlook",
    "buy gold",
  ],
  openGraph: {
    type: "website",
    siteName: "GoldCompass",
    title: "GoldCompass — Smart Gold Investing Guidance",
    description:
      "Clear gold-market outlooks, live price trends, and a smart gold calculator for everyday investors.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "GoldCompass — Smart Gold Investing Guidance",
    description:
      "Clear gold-market outlooks, live price trends, and a smart gold calculator for everyday investors.",
  },
  robots: { index: true, follow: true },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main id="main" className="flex-1 scroll-mt-16">
          {children}
        </main>
        <SiteFooter />
        {cfBeaconToken ? (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: cfBeaconToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
