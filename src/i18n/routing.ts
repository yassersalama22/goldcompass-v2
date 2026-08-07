import { defineRouting } from "next-intl/routing";

import { ACTIVE_LOCALE_CODES, DEFAULT_LOCALE } from "@/config/locales";

/**
 * Locale routing configuration.
 *
 * The locale list comes from `src/config/locales.ts` rather than being spelled
 * out here, so enabling a language is a single edit in the registry.
 *
 * Three defaults are turned OFF deliberately — each one would be actively
 * harmful on this deployment:
 *
 * `localeDetection: false`
 *   next-intl's default redirects based on the `Accept-Language` header.
 *   Cloudflare caches this site's HTML at the edge and **ignores `Vary`**
 *   (CLAUDE.md 2026-07-27), so that redirect would be stored under the URL's
 *   cache key and then served to *everyone* — one Arabic-speaking visitor could
 *   pin `/` to a redirect to `/ar` for the whole world, and vice versa. This is
 *   the same class of failure as the RSC flight payload poisoning the home page.
 *   Language selection is therefore always an explicit user action.
 *
 * `localeCookie: false`
 *   Follows from the above: with no automatic detection there is nothing for a
 *   locale cookie to feed, and a `Set-Cookie` on cacheable HTML is another way
 *   to get a response pinned per-visitor at the edge. It also keeps the site
 *   cookie-free.
 *
 * `alternateLinks: false`
 *   The middleware would emit a `Link:` header advertising every locale for
 *   every path. We only want to advertise a locale for a path that *actually
 *   has* a translation — a dangling hreflang is worse for SEO than none — so
 *   hreflang is emitted per page from the Metadata API instead, where the
 *   existence check can happen.
 *
 * `localePrefix: "as-needed"`
 *   English stays at `/outlook`, Arabic goes to `/ar/outlook`. Every URL indexed
 *   before this site was multilingual keeps its exact address.
 *   `localizePath()` in the registry is the advertising-side twin of this
 *   setting; the two must stay in agreement.
 */
export const routing = defineRouting({
  locales: ACTIVE_LOCALE_CODES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
});
