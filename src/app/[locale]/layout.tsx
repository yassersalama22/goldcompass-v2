import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ThemeScript } from "@/components/theme/theme-script";
import {
  ACTIVE_LOCALES,
  isActiveLocale,
  localizePath,
  requireLocale,
} from "@/config/locales";
import { localeOpenGraph } from "@/lib/seo";

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

// Turnstile widget host — the subscribe form (rendered in the footer on every
// page) loads api.js from here, but only when the site key is set.
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("defaultTitle"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    applicationName: "GoldCompass",
    keywords: t("keywords").split("|"),
    openGraph: {
      type: "website",
      siteName: "GoldCompass",
      title: t("defaultTitle"),
      description: t("ogDescription"),
      url: localizePath("/", locale),
      ...localeOpenGraph(locale),
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("ogDescription"),
    },
    robots: { index: true, follow: true },
    ...(googleSiteVerification
      ? { verification: { google: googleSiteVerification } }
      : {}),
  };
}

/**
 * Prerender one shell per active locale. Declared on the layout so it applies to
 * every child segment; children with their own dynamic params (article slugs)
 * add theirs on top.
 */
export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale: locale.code }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // The `[locale]` segment is a catch-all: an unknown top-level path arrives
  // here as a "locale". 404 rather than rendering an English page under a
  // nonsense prefix, which would be indexable duplicate content.
  if (!isActiveLocale(locale)) notFound();

  // Opts this subtree back into static rendering. Next 16.2 predates
  // `next/root-params` being available without an experimental flag, so this is
  // the supported way to keep every page prerendered — without it, reading the
  // locale forces dynamic rendering site-wide and forfeits the Cloudflare edge
  // caching the whole SEO/perf story rests on.
  setRequestLocale(locale);

  const { dir, hreflang } = requireLocale(locale);

  return (
    <html
      lang={hreflang}
      dir={dir}
      // ThemeScript adds the `dark` class + a colorScheme style to <html> before
      // hydration, so this element alone legitimately differs from what the
      // server emitted. Scoped to <html>; everything inside still hydrates
      // strictly.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Must run before first paint — see the component for why. */}
        <ThemeScript />
        {/*
          Warm the TCP+TLS handshake for the two third-party hosts we always
          load (Lighthouse: ~420ms). React 19 hoists these into <head>. Each is
          gated on the same env var that decides whether the resource loads at
          all — a preconnect to a host we never hit just wastes a connection.
        */}
        {turnstileSiteKey ? (
          <link rel="preconnect" href="https://challenges.cloudflare.com" />
        ) : null}
        {cfBeaconToken ? (
          <link rel="preconnect" href="https://static.cloudflareinsights.com" />
        ) : null}
        {/*
          Supplies messages to client components (the subscribe form, the
          calculators, the theme toggle). Server components read messages
          directly via `getTranslations` and send only rendered text, so this
          provider exists for the interactive leaves — not as a general channel.
          Keep an eye on what it serialises into the HTML: passing the whole
          catalog would ship every page's strings to every visitor.
        */}
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main" className="flex-1 scroll-mt-16">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
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
