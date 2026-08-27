/**
 * Markdown content negotiation — the pure decision layer.
 *
 * Shared by `src/proxy.ts` (which runs in the Edge runtime) and the
 * markdown route handler, so this module must stay free of Node APIs,
 * `server-only`, and anything that reads the filesystem.
 *
 * Background: agents increasingly ask for `Accept: text/markdown` so they get
 * clean prose instead of parsing a page's HTML. Cloudflare sells this as an
 * edge feature ("Markdown for Agents"), but it is Pro-plan and up, and it works
 * by converting our *rendered HTML* back into Markdown. We do it at the origin
 * instead: our outlook analysis and article bodies are already Markdown
 * upstream, so we emit the source rather than a lossy round-trip through HTML,
 * and no nav/footer chrome comes along for the ride.
 *
 * See docs/agent-readiness-checklist.md §2.
 */

/** The path the proxy rewrites markdown requests to. */
export const MARKDOWN_ROUTE_PREFIX = "/agent-markdown";

/**
 * Does this request explicitly ask for Markdown *in preference to* HTML?
 *
 * The rules are deliberately strict, because getting this wrong is the one way
 * this feature could hurt real users or search rankings:
 *
 *  - `text/markdown` must appear **explicitly**. A wildcard never counts.
 *    Googlebot and browsers both send an Accept list that ends in a catch-all
 *    wildcard and never names Markdown; matching a wildcard or a `text` type
 *    range would serve Markdown to crawlers and to people. Neither can match
 *    here, because only exact type strings are compared.
 *  - Markdown must rank at least as high as any explicitly listed `text/html`.
 *    A client that says `text/html,text/markdown;q=0.9` prefers HTML, so it
 *    gets HTML.
 *  - `q=0` means "not acceptable" and never matches.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;

  let markdownQ: number | null = null;
  let htmlQ: number | null = null;

  for (const part of accept.split(",")) {
    const [rawType, ...params] = part.split(";");
    const type = rawType.trim().toLowerCase();
    if (type !== "text/markdown" && type !== "text/html") continue;

    // Default q is 1 per RFC 9110; only an explicit q parameter lowers it.
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=");
      if (key?.trim().toLowerCase() !== "q") continue;
      const parsed = Number.parseFloat(value ?? "");
      if (Number.isFinite(parsed)) q = parsed;
    }

    // Keep the highest q if a type is somehow listed more than once.
    if (type === "text/markdown") markdownQ = Math.max(markdownQ ?? 0, q);
    else htmlQ = Math.max(htmlQ ?? 0, q);
  }

  if (markdownQ === null || markdownQ <= 0) return false;
  return htmlQ === null || markdownQ >= htmlQ;
}

/**
 * Which paths have a Markdown representation.
 *
 * Only routes whose content comes from the data-access layer are listed. A page
 * whose prose lives in JSX gets no entry here: a Markdown twin would be a
 * hand-maintained copy that silently drifts from the component, which is worse
 * than serving the HTML an agent can already read. Falling through to HTML is a
 * valid content-negotiation outcome.
 *
 * `/disclaimer` is listed because its body genuinely moved into a content
 * artifact (`src/content/pages/disclaimer.md`), so the Markdown served IS the
 * source rather than a copy of it. `/about`, `/methodology` and `/ai-disclosure`
 * are deliberately absent — they are designed layouts (card grids, definition
 * lists, a styled step sequence, section icons, heading anchors other pages link
 * to), not prose documents, and flattening them into Markdown would lose the
 * design without making them any more accurate.
 */
const STATIC_MARKDOWN_PATHS = new Set([
  "/",
  "/outlook",
  "/trends",
  "/insights",
  "/insights/explainers",
  "/insights/market-updates",
  "/disclaimer",
]);

/**
 * True when `pathname` can be served as Markdown.
 *
 * Article slugs are matched by shape rather than by looking them up: resolving
 * a real slug needs the filesystem, which the Edge-runtime proxy cannot
 * touch. A shape match that turns out not to exist yields a Markdown 404 from
 * the route handler, which is the correct answer for that request anyway.
 */
export function hasMarkdownRepresentation(pathname: string): boolean {
  // Tolerate a trailing slash on everything except the root itself.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (STATIC_MARKDOWN_PATHS.has(path)) return true;

  // /insights/<slug> — one more segment, no file extension (rss.xml, and any
  // future asset under /insights, must keep their real content type).
  const match = /^\/insights\/([a-z0-9-]+)$/.exec(path);
  return match !== null;
}
