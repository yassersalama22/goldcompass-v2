import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isActiveLocale } from "@/config/locales";

/**
 * Per-request i18n configuration. `next-intl`'s plugin wires this file in
 * automatically (it is the default `./src/i18n/request.ts` location).
 *
 * UI message catalogs live at `src/content/i18n/ui/<locale>.json`, alongside the
 * other content artifacts rather than under `src/` code — they are content, they
 * are translated by the same pipeline as articles, and keeping them in
 * `src/content/**` means `outputFileTracingIncludes` in `next.config.ts` already
 * carries them into the standalone Docker bundle.
 *
 * Deliberately NOT configured here: number/date formats. `src/lib/format.ts`
 * stays the one formatting utility, because it is also called from
 * `src/server/markdown/index.ts` and from `.mts` pipeline scripts, neither of
 * which runs inside a React render and so neither of which can reach a
 * `next-intl` formatter. It also maps a locale code to the registry's
 * `intlLocale`, which carries the Unicode extension (`ar-u-nu-latn`) that the
 * route segment cannot. Using `useFormatter()` here would quietly produce
 * Arabic-Indic digits in half the app and Latin digits in the other half.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // `requestLocale` can be undefined or garbage: the `[locale]` segment acts as
  // a catch-all for unknown paths, so an unmatched URL arrives here as a
  // "locale". Fall back rather than throw — an unknown segment should 404 as a
  // page, not 500 the request.
  const locale =
    requested && isActiveLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../content/i18n/ui/${locale}.json`)).default,

    // Pinned to UTC, and not negotiable. The container runs UTC while a
    // visitor's browser does not, and an unpinned zone makes server and client
    // render different text for the same timestamp — exactly the hydration bug
    // (React #418) that `price-ticker.tsx` and `formatShortDate` were fixed for
    // on 2026-07-27. Anything that must show local time renders it after mount.
    timeZone: "UTC",

    onError(error) {
      // A missing message must be loud in development and logged in production:
      // a half-translated page should not crash for a reader, but it must never
      // pass CI unnoticed either.
      if (process.env.NODE_ENV === "development") throw error;
      console.warn(`[i18n] ${locale}: ${error.message}`);
    },
  };
});
