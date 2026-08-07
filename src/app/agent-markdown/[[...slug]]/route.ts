import { DEFAULT_LOCALE, isActiveLocale } from "@/config/locales";
import { buildMarkdown } from "@/server/markdown";

/**
 * Markdown representations for `Accept: text/markdown`.
 *
 * `src/proxy.ts` rewrites a negotiated request here — `/outlook` becomes
 * `/agent-markdown/en/outlook` and `/ar/outlook` becomes
 * `/agent-markdown/ar/outlook` — so the visitor-facing URL never changes and the
 * HTML routes stay statically prerendered. The path is also directly
 * fetchable, which makes it testable with curl, but nothing links to it and
 * robots.txt disallows it so it cannot become a duplicate-content surface.
 *
 * The locale is always the first segment. It is written by the proxy from the
 * locale registry, but this route re-validates it rather than trusting it: the
 * path is publicly fetchable, so an unknown first segment must fall back to the
 * canonical locale instead of reaching the content layer as a bogus lookup key.
 *
 * Dynamic on purpose: the response depends on the rewritten path and reads the
 * article artifacts from disk. The underlying upstream calls (CoinGecko, via
 * the price data-access layer) still use Next's data cache, so agent traffic
 * here cannot amplify into upstream requests.
 */
export const dynamic = "force-dynamic";

/**
 * Rough token estimate for the `x-markdown-tokens` header agents use to plan
 * chunking. Four characters per token is the usual English heuristic — this is
 * an estimate, not a tokenizer, and is advisory only.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug } = await params;

  const [first, ...rest] = slug ?? [];
  const locale = first && isActiveLocale(first) ? first : DEFAULT_LOCALE;
  // When the first segment was a locale it is consumed; otherwise the whole
  // slug is the path (a hand-typed `/agent-markdown/outlook` still works).
  const segments = first && isActiveLocale(first) ? rest : (slug ?? []);
  const pathname = segments.length ? `/${segments.join("/")}` : "/";

  const markdown = await buildMarkdown(pathname, locale);

  /*
   * `no-store` is defense in depth against the cache-key hazard described in
   * the proxy: Cloudflare ignores `Vary`, so the zone's "Cache public
   * pages" rule already excludes markdown requests. This header means that even
   * if that rule were edited away, a Markdown body still could not be stored
   * under the HTML cache key and served to a browser.
   *
   * `Vary: Accept` is correct and is sent for any well-behaved intermediary
   * that does honour it. It is deliberately NOT added to the HTML responses:
   * Cloudflare would ignore it anyway, some intermediaries stop caching
   * entirely when they see it, and the only dangerous direction — Markdown
   * reaching a browser — is already closed by `no-store`.
   */
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Accept",
  };

  if (markdown === null) {
    return new Response(
      `# Not found\n\nThere is no page at \`${pathname}\` on GoldCompass.\n`,
      {
        status: 404,
        headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
      },
    );
  }

  return new Response(markdown, {
    headers: {
      ...headers,
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Markdown-Tokens": String(estimateTokens(markdown)),
    },
  });
}
