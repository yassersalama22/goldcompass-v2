import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { splitLocalePath, stripAnyLocalePrefix } from "@/config/locales";
import { routing } from "@/i18n/routing";
import {
  MARKDOWN_ROUTE_PREFIX,
  hasMarkdownRepresentation,
  prefersMarkdown,
} from "@/lib/agent-markdown";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Two concerns, resolved in one pass: Markdown content negotiation for agents,
 * and locale routing.
 *
 * ── Markdown negotiation ────────────────────────────────────────────────────
 * A request that explicitly asks for `Accept: text/markdown` is rewritten to
 * the Markdown route handler; everything else gets the normal, statically
 * prerendered HTML.
 *
 * This is the `proxy` file convention — Next 16 renamed `middleware.ts` to
 * `proxy.ts`, and the exported function from `middleware` to `proxy`.
 *
 * Why the proxy rather than reading the header in the page components: calling
 * `headers()` inside a Server Component opts that route out of static rendering
 * for *everyone*, which would forfeit prerendering and Cloudflare edge caching
 * on our most important pages. The proxy inspects the header before routing, so
 * every page stays static and no client JS is added.
 *
 * ⚠ Cache-key hazard, and this site has history here: Cloudflare ignores `Vary`
 * except `Accept-Encoding`, so a Markdown body could in principle be stored
 * under the HTML cache key and served to browsers — exactly how the RSC flight
 * payload broke the home page (CLAUDE.md 2026-07-27). Two guards, both live:
 * the zone's "Cache public pages" rule excludes requests carrying
 * `Accept: text/markdown`, and the Markdown responses themselves are `no-store`.
 *
 * ── Locale routing ──────────────────────────────────────────────────────────
 * `next-intl` handles the `[locale]` segment with `localePrefix: "as-needed"`,
 * so `/outlook` renders English and `/ar/outlook` renders Arabic, and every URL
 * indexed before this site was multilingual keeps its exact address.
 *
 * Markdown is checked **first and bypasses the intl middleware entirely**. The
 * Markdown route lives outside the `[locale]` tree and carries the locale as
 * its first path segment, so letting the intl middleware also rewrite the path
 * would produce a double prefix. The locale is extracted here instead, from the
 * same registry that produced the URL.
 */

/**
 * Next's file-convention metadata images (`opengraph-image.tsx` and friends).
 * The optional suffix is the generated id Next appends when a segment has more
 * than one.
 */
const METADATA_IMAGE_ROUTE =
  /\/(opengraph-image|twitter-image|icon|apple-icon)(-[a-z0-9]+)?\/?$/;

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  /*
   * Metadata images are rewritten, never redirected.
   *
   * These routes live under `[locale]`, so Next generates their URLs *with* the
   * locale segment — `/en/opengraph-image` — and advertises that in `og:image`.
   * Left to the intl middleware, `as-needed` prefixing would 307 that URL to the
   * unprefixed form, so every `og:image` in the site's HTML would point at a
   * redirect. That redirect is right for a page a human navigates to and wrong
   * here: several social-preview scrapers do not follow redirects on images, and
   * the ones that do pay an extra round trip on every unfurl.
   *
   * Rewriting instead means both spellings serve the PNG directly — the
   * prefixed one Next emits today, and the unprefixed one already baked into
   * previously shared links and social caches.
   */
  if (METADATA_IMAGE_ROUTE.test(pathname)) {
    const { locale, path } = stripAnyLocalePrefix(pathname);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${path}`;
    return NextResponse.rewrite(url);
  }

  if (prefersMarkdown(request.headers.get("accept"))) {
    // Split before the check: `hasMarkdownRepresentation` describes
    // locale-independent paths (`/outlook`), not prefixed ones (`/ar/outlook`).
    const { locale, path } = splitLocalePath(pathname);

    if (hasMarkdownRepresentation(path)) {
      const url = request.nextUrl.clone();
      url.pathname = `${MARKDOWN_ROUTE_PREFIX}/${locale}${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
    // No Markdown source for this route — serving the HTML is a valid outcome,
    // so fall through to normal locale routing rather than 404ing.
  }

  return intlMiddleware(request);
}

export const config = {
  /*
   * Skip everything that can never need either concern, so the proxy is not
   * invoked for asset requests: Next's build output, the JSON API (which serves
   * its own contract regardless of Accept), and the Markdown route itself (no
   * rewrite loops).
   *
   * ⚠ Unlike the usual next-intl matcher, this does NOT exclude every path
   * containing a dot. `/insights/rss.xml` lives *inside* the `[locale]` tree, so
   * the unprefixed English form has to reach the intl middleware to be rewritten
   * to `/en/insights/rss.xml` — excluding dotted paths would 404 the feed.
   *
   * Instead the root-level metadata routes, which live *outside* `[locale]` and
   * must never be prefixed, are listed explicitly, along with `/brand/` for the
   * static image assets.
   */
  matcher: [
    "/((?!_next/|api/|agent-markdown(?:/|$)|brand/|robots\\.txt|sitemap\\.xml|llms\\.txt|icon\\.svg|favicon\\.ico).*)",
  ],
};
