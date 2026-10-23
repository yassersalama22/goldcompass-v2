import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import {
  ACTIVE_LOCALES,
  DEFAULT_LOCALE,
  localizePath,
  requireLocale,
} from "@/config/locales";

/**
 * Locale-aware canonical + hreflang for a page's `metadata`.
 *
 * `path` is the locale-*independent* path (`/outlook`, `/insights/<slug>`),
 * exactly as it appeared before this site was multilingual. The locale prefix is
 * applied here, in one place, so no page has to know the prefixing rule.
 *
 * Two properties this must preserve:
 *
 *  1. **The canonical is self-referencing.** Each locale's page points at
 *     itself, never at the English original. Pointing translations at the source
 *     would ask Google to drop them from the index entirely.
 *
 *  2. **hreflang only advertises translations that exist.** `availableLocales`
 *     defaults to every active locale, which is right for pages that are always
 *     translated (the chrome-driven ones). Pages backed by per-locale artifacts —
 *     articles, the outlook — must pass the locales they actually have. A
 *     hreflang pointing at a 404 or at an untranslated page is worse than no
 *     hreflang at all, because it invites Google to swap the wrong URL into
 *     results for the wrong audience.
 *
 * When only one locale is active the whole `languages` map is omitted: a
 * single-entry hreflang set says nothing, and leaving it out keeps the emitted
 * HTML identical to the pre-i18n site.
 */
export function localeAlternates(
  path: string,
  locale: string,
  availableLocales: readonly string[] = ACTIVE_LOCALES.map((l) => l.code),
): NonNullable<Metadata["alternates"]> {
  const canonical = localizePath(path, locale);

  const advertised = ACTIVE_LOCALES.filter((l) =>
    availableLocales.includes(l.code),
  );
  if (advertised.length < 2) return { canonical };

  const languages: Record<string, string> = {};
  for (const l of advertised) {
    languages[l.hreflang] = localizePath(path, l.code);
  }

  // x-default names the page to serve when no advertised language matches the
  // user. The canonical locale is the authored one, so it is the honest default.
  if (availableLocales.includes(DEFAULT_LOCALE)) {
    languages["x-default"] = localizePath(path, DEFAULT_LOCALE);
  }

  return { canonical, languages };
}

/**
 * Params every page under `src/app/[locale]` receives.
 *
 * Next 15+ passes `params` as a promise, so pages await it. Declared once here
 * because every page and `generateMetadata` in the tree needs the same shape.
 */
export type LocaleParams = { params: Promise<{ locale: string }> };

/**
 * Apply the locale to a page's static metadata: canonical + hreflang, and the
 * locale-prefixed Open Graph URL.
 *
 * Pages keep declaring their titles and descriptions as a plain object; this
 * folds in everything that depends on which language is being rendered, so no
 * page has to remember the three separate places a locale leaks into metadata.
 */
export function withLocaleMetadata(
  base: Metadata,
  path: string,
  locale: string,
  availableLocales?: readonly string[],
  /**
   * Set when the route segment has its own `opengraph-image` (outlook,
   * articles). Config `images` OUTRANK a segment's image file — verified: with
   * the default set, `/outlook` lost its dynamic card to the brand card — so
   * these pages must leave `images` unset for their file to apply.
   */
  options: { ownImage?: boolean } = {},
): Metadata {
  const title =
    (base.openGraph?.title as string | undefined) ??
    (typeof base.title === "string" ? base.title : undefined);
  const description = base.openGraph?.description ?? base.description ?? undefined;

  // A page with no title of its own (the home page) keeps the layout's social
  // metadata, which already describes it.
  if (!title) {
    return { ...base, alternates: localeAlternates(path, locale, availableLocales) };
  }

  /*
   * Always emit COMPLETE `openGraph` and `twitter` blocks per page.
   *
   * Next replaces a parent's `openGraph`/`twitter` object wholesale rather than
   * merging it, which broke social previews both ways until 2026-10-23:
   *  - pages that set no `openGraph` inherited the layout's, so `/trends`,
   *    `/insights` and `/disclaimer` previewed as the HOME page (og:url, title
   *    and description all the homepage's);
   *  - pages that set a partial `openGraph` lost the layout's `siteName` and the
   *    site-wide image, so the calculators, `/about`, `/methodology`,
   *    `/ai-disclosure` and the insight views shared with no image at all;
   *  - no page set `twitter`, so every page — `/outlook` included — sent the
   *    homepage's `twitter:title`.
   * The brand card is the default image; see `options.ownImage`.
   */
  const images = options.ownImage
    ? {}
    : {
        images: base.openGraph?.images ?? [
          { url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: siteConfig.name },
        ],
      };

  return {
    ...base,
    alternates: localeAlternates(path, locale, availableLocales),
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      ...base.openGraph,
      title,
      ...(description ? { description } : {}),
      ...images,
      url: localizePath(path, locale),
      ...localeOpenGraph(locale, availableLocales),
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
      ...images,
      ...base.twitter,
    },
  };
}

/**
 * `og:locale` (+ `og:locale:alternate`) for a page.
 *
 * Facebook/LinkedIn want underscore-separated tags, unlike hreflang — the
 * registry stores both rather than deriving one from the other, because the
 * mapping is not mechanical for every language.
 */
export function localeOpenGraph(
  locale: string,
  availableLocales: readonly string[] = ACTIVE_LOCALES.map((l) => l.code),
): { locale: string; alternateLocale?: string[] } {
  const current = requireLocale(locale);
  const alternates = ACTIVE_LOCALES.filter(
    (l) => l.code !== locale && availableLocales.includes(l.code),
  ).map((l) => l.ogLocale);

  return {
    locale: current.ogLocale,
    ...(alternates.length > 0 ? { alternateLocale: alternates } : {}),
  };
}
