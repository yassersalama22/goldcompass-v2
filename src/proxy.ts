import { NextResponse, type NextRequest } from "next/server";

import {
  MARKDOWN_ROUTE_PREFIX,
  hasMarkdownRepresentation,
  prefersMarkdown,
} from "@/lib/agent-markdown";

/**
 * Markdown content negotiation for agents.
 *
 * A request that explicitly asks for `Accept: text/markdown` is rewritten to
 * the Markdown route handler; everything else is passed straight through and
 * gets the normal, statically prerendered HTML.
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
 * Cost on the request path is one header parse. Real users overwhelmingly never
 * reach this code at all — their HTML is served from the Cloudflare edge cache.
 *
 * ⚠ Cache-key hazard, and this site has history here: Cloudflare ignores `Vary`
 * except `Accept-Encoding`, so a Markdown body could in principle be stored
 * under the HTML cache key and served to browsers — exactly how the RSC flight
 * payload broke the home page (CLAUDE.md 2026-07-27). Two guards, both live:
 * the zone's "Cache public pages" rule excludes requests carrying
 * `Accept: text/markdown`, and the Markdown responses themselves are `no-store`.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!prefersMarkdown(request.headers.get("accept"))) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (!hasMarkdownRepresentation(pathname)) {
    // No Markdown source for this route — serving the HTML is a valid outcome.
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${MARKDOWN_ROUTE_PREFIX}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  /*
   * Skip everything that can never need negotiation, so the proxy is not
   * invoked for asset requests: Next's build output, the JSON API (which serves
   * its own contract regardless of Accept), the Markdown route itself (no
   * rewrite loops), and any path with a file extension — which covers
   * robots.txt, sitemap.xml, llms.txt, /insights/rss.xml, icons and images.
   */
  matcher: [
    "/((?!_next/|api/|agent-markdown(?:/|$)|.*\\.[^/]+$).*)",
  ],
};
