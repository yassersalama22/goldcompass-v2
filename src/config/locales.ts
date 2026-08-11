/**
 * Locale registry — the single source of truth for every language the site
 * knows about.
 *
 * Everything iterates this: routing, `generateStaticParams`, hreflang,
 * `sitemap.ts`, the translation pipeline, and the automated translation checks.
 * Adding a language should be one entry here plus a glossary — if it ever needs
 * a code change somewhere else, that somewhere else is reading the wrong thing.
 *
 * Two lists, deliberately:
 *  - `LOCALES` is every locale the *contracts* know about. A translated
 *    artifact can exist for a locale that is not yet routed, which is how a
 *    language gets backfilled and reviewed before anyone can reach it.
 *  - `ACTIVE_LOCALES` is what is actually routed and advertised. Flipping
 *    `enabled` is the launch switch.
 */

export type Direction = "ltr" | "rtl";

/**
 * How much a translation into this locale can be trusted without a fluent
 * reviewer.
 *
 *  - `native`   — someone who reads the language reviews every artifact before
 *                 it publishes.
 *  - `assisted` — nobody here reads it. The gate is the glossary, the automated
 *                 checks, and a back-translation review, and the translation
 *                 disclosure says so plainly.
 *
 * This field is what makes adding a language the owner does not speak a
 * configuration change rather than a leap of faith.
 */
export type ReviewPolicy = "native" | "assisted";

export interface LocaleDef {
  code: string;
  dir: Direction;
  /** Native name — the language switcher shows each language in its own script. */
  label: string;
  /** English name, for `aria-label`s, logs, and PR bodies. */
  englishLabel: string;
  /**
   * BCP-47 tag handed to `Intl.*`.
   *
   * Note `-u-nu-latn` on Arabic: the bare `ar` locale formats numbers with
   * Arabic-Indic digits (٤٬١٦٠). We force Latin digits because the SVG price
   * chart draws Latin numerals on its axis and Arabic financial media uses
   * Latin digits — mixing the two in one page would look like a bug.
   */
  intlLocale: string;
  /** `hreflang` value and `<html lang>`. */
  hreflang: string;
  /** `og:locale` — underscore-separated, unlike hreflang. */
  ogLocale: string;
  /**
   * The language content is authored in. Exactly one locale has this, and it is
   * the translation source for all the others.
   */
  canonical: boolean;
  /** Routed and advertised? See the note above about the two lists. */
  enabled: boolean;
  reviewPolicy: ReviewPolicy;
  /**
   * Acceptable translated-length band as a multiple of the English source's
   * character count. The translation checker fails outside it, which is how
   * truncation and omission get caught without reading the language.
   *
   * Arabic runs shorter than English; Spanish runs longer.
   */
  lengthRatio: readonly [number, number];
  /**
   * CSS variable holding the script's typeface, when the default (Geist) has no
   * glyphs for it. Applied on the `<html>` element by the locale layout.
   */
  fontVariable?: string;
}

export const LOCALES: readonly LocaleDef[] = [
  {
    code: "en",
    dir: "ltr",
    label: "English",
    englishLabel: "English",
    intlLocale: "en-US",
    hreflang: "en",
    ogLocale: "en_US",
    canonical: true,
    enabled: true,
    reviewPolicy: "native",
    lengthRatio: [1, 1],
  },
  {
    code: "ar",
    dir: "rtl",
    label: "العربية",
    englishLabel: "Arabic",
    intlLocale: "ar-u-nu-latn",
    hreflang: "ar",
    ogLocale: "ar_AR",
    canonical: false,
    // Enabled in Phase B, once RTL layout and the Arabic typeface are in place.
    // Until then the contracts accept `ar` artifacts but nothing routes to them.
    enabled: false,
    reviewPolicy: "native",
    lengthRatio: [0.75, 1.15],
    fontVariable: "--font-arabic",
  },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

/**
 * Development/preview override for the active set, e.g.
 * `NEXT_PUBLIC_LOCALES_ENABLED="en,ar"`.
 *
 * The registry's `enabled` flag stays the source of truth for production — this
 * exists so a language can be built and exercised *before* it is fit to publish.
 * Enabling a locale makes it routed, prerendered, listed in `sitemap.xml`, and
 * advertised in hreflang; doing that to a half-translated language is worse than
 * shipping English only, so the switch that opens it to search engines should be
 * a reviewed code change, not an env var someone sets once and forgets.
 *
 * ⚠ Must be `NEXT_PUBLIC_` and therefore build-time. `ACTIVE_LOCALES` is read by
 * the language switcher, which is a client component: a server-only variable
 * would be `undefined` in the browser bundle, the switcher would render on the
 * server and vanish on hydration, and React would throw a mismatch.
 * It is also threaded through the Dockerfile as a build arg for the same reason
 * as the Turnstile site key — it is inlined into the client bundle at build
 * time, so setting it only in the container's runtime env does nothing.
 */
const localesOverride = process.env.NEXT_PUBLIC_LOCALES_ENABLED?.split(",")
  .map((code) => code.trim())
  .filter(Boolean);

/** Locales that are routed, prerendered, and advertised in hreflang. */
export const ACTIVE_LOCALES: readonly LocaleDef[] = LOCALES.filter((l) =>
  localesOverride ? localesOverride.includes(l.code) : l.enabled,
);

/** Just the codes — what `next-intl` routing and `generateStaticParams` want. */
export const ACTIVE_LOCALE_CODES: readonly string[] = ACTIVE_LOCALES.map((l) => l.code);

// The canonical locale is the routing fallback and the translation source, so
// it can never be switched off. Fail at import rather than letting next-intl
// receive a `defaultLocale` that is not in its `locales` list, which surfaces
// much further away as a confusing routing error.
if (!ACTIVE_LOCALE_CODES.includes(LOCALES.find((l) => l.canonical)!.code)) {
  throw new Error(
    "NEXT_PUBLIC_LOCALES_ENABLED must include the canonical locale.",
  );
}

/**
 * The authoring language. Content is written in this locale and translated out
 * of it; it is also the locale served at the unprefixed root path.
 */
export const CANONICAL_LOCALE: LocaleDef = (() => {
  const canonical = LOCALES.filter((l) => l.canonical);
  if (canonical.length !== 1) {
    throw new Error(
      `Exactly one locale must be canonical; found ${canonical.length}.`,
    );
  }
  return canonical[0]!;
})();

export const DEFAULT_LOCALE = CANONICAL_LOCALE.code;

export function getLocale(code: string): LocaleDef | undefined {
  return LOCALES.find((l) => l.code === code);
}

/** Throwing accessor for paths where the locale has already been validated. */
export function requireLocale(code: string): LocaleDef {
  const locale = getLocale(code);
  if (!locale) throw new Error(`Unknown locale: ${code}`);
  return locale;
}

export function isActiveLocale(code: string): boolean {
  return ACTIVE_LOCALE_CODES.includes(code);
}

export function isRtl(code: string): boolean {
  return getLocale(code)?.dir === "rtl";
}

/** Locales a translation pipeline should produce: every active, non-canonical one. */
export const TRANSLATION_TARGETS: readonly LocaleDef[] = ACTIVE_LOCALES.filter(
  (l) => !l.canonical,
);

/**
 * Prefix a path with the locale segment.
 *
 * The canonical locale is served unprefixed (`/outlook`, not `/en/outlook`) so
 * that every URL indexed before this site was multilingual keeps its exact
 * address — no redirects, no ranking churn. This mirrors `next-intl`'s
 * `localePrefix: "as-needed"`, and the two must agree: this function decides
 * what we *advertise* (canonicals, hreflang, sitemap, `Link` hrefs), while the
 * routing config decides what the server *accepts*.
 */
export function localizePath(path: string, locale: string): string {
  const normalized = path === "/" ? "" : path;
  if (locale === DEFAULT_LOCALE) return normalized || "/";
  return `/${locale}${normalized}`;
}

/**
 * Split a pathname on *any* known locale prefix, including the canonical one.
 *
 * Distinct from `splitLocalePath`, which describes the public URL shape (where
 * `/en/outlook` is not a valid address — it redirects). This one describes the
 * internal route shape, where every page really does live under a `[locale]`
 * segment. Used by the proxy for routes that Next addresses internally,
 * like metadata image routes.
 */
export function stripAnyLocalePrefix(pathname: string): {
  locale: string;
  path: string;
} {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const candidate = match?.[1];
  if (candidate && isActiveLocale(candidate)) {
    return { locale: candidate, path: match?.[2] || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * Inverse of `localizePath`: split a pathname into its locale and the
 * locale-independent path. An unprefixed path belongs to the canonical locale.
 *
 * Only *active* prefixes are recognised. A path like `/ar/outlook` while Arabic
 * is disabled is not a locale route — it is a 404, which is the correct answer
 * for a language we do not serve yet.
 */
export function splitLocalePath(pathname: string): {
  locale: string;
  path: string;
} {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const candidate = match?.[1];
  if (candidate && candidate !== DEFAULT_LOCALE && isActiveLocale(candidate)) {
    return { locale: candidate, path: match?.[2] || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}
