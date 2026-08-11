import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import { notFound } from "next/navigation";
import { DirectionProvider } from "@base-ui/react/direction-provider";
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
  // Its own variable rather than `--font-sans` directly: `--font-sans` is the
  // design-system token, and the Arabic override in globals.css needs to
  // *redefine* that token while still pointing at Geist as the Latin fallback.
  // If next/font owned `--font-sans`, overriding it would drop Geist entirely
  // and Latin runs inside Arabic prose would fall back to a system face.
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Geist has no Arabic glyphs, so without this every Arabic page would render in
 * whatever the browser falls back to — usually a system serif that clashes with
 * the brand and, on some platforms, has poor hinting at small sizes.
 *
 * IBM Plex Sans Arabic is chosen for tone (a neutral humanist sans that sits
 * beside Geist without looking like a different site) and for having the weights
 * the design system actually uses. Self-hosted by `next/font`, so the CSP's
 * `font-src 'self'` needs no change and there is no third-party request.
 *
 * The variable is attached to `<html>` only for RTL locales, so a visitor
 * reading English never downloads an Arabic font: `@font-face` files are fetched
 * lazily, only when something on the page actually resolves to them.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
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
  const rtl = dir === "rtl";

  return (
    <html
      lang={hreflang}
      dir={dir}
      // ThemeScript adds the `dark` class + a colorScheme style to <html> before
      // hydration, so this element alone legitimately differs from what the
      // server emitted. Scoped to <html>; everything inside still hydrates
      // strictly.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${
        // Only RTL locales carry the Arabic face, and `font-arabic` is what
        // `globals.css` keys the `--font-sans` override off — see the note there.
        rtl ? `${plexArabic.variable} font-arabic` : ""
      } h-full antialiased`}
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
          {/*
            Base UI reads direction from context, not from the `dir` attribute,
            so its primitives (the mobile-nav Sheet, and anything added later
            with a side or an inline offset) need to be told explicitly. Without
            this the DOM flips but Base UI's own positioning does not.
          */}
          <DirectionProvider direction={dir}>
            <SiteHeader />
            <main id="main" className="flex-1 scroll-mt-16">
              {children}
            </main>
            <SiteFooter />
          </DirectionProvider>
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
