import { INSIGHT_KINDS } from "@/config/insight-kinds";
import { siteConfig } from "@/config/site";
import { FLAGSHIP_TOOL, TOOLS } from "@/config/tools";
import { getAllArticles } from "@/server/articles";

/**
 * /llms.txt — an LLM-friendly map of the site, per https://llmstxt.org/.
 *
 * Not scored by the agent-readiness scanner, but it is the file agents actually
 * fetch today: one plain-text document that says what this site is and where
 * the substantive pages live, so a model does not have to crawl and parse HTML
 * to find them.
 *
 * Built from the same sources as `sitemap.ts` (site/tool/insight-kind config +
 * the articles data-access layer) so it cannot drift from what is published.
 * See `docs/agent-readiness-checklist.md`.
 */
const { url } = siteConfig;

/** `- [title](url): description` — the link format llms.txt expects. */
function link(title: string, href: string, description: string): string {
  return `- [${title}](${url}${href}): ${description}`;
}

function buildBody(): string {
  const articles = getAllArticles();

  const sections: string[] = [
    `# GoldCompass`,
    ``,
    `> Gold-investing guidance for everyday investors: a dated directional outlook on the gold price, live XAU/USD trends, calculators for physical gold purchases, and cited market analysis.`,
    ``,
    `GoldCompass publishes a short-term (weeks) and long-term (months) view on gold, each with a signal, a confidence level, and an invalidation level that says what would prove it wrong. Analysis is drafted by a large language model against deterministic market data and reviewed by a human before publication — see the AI disclosure and methodology pages for exactly what that means.`,
    ``,
    `Educational content only. Nothing here is financial advice, and no investment products are sold.`,
    ``,
    `## Market outlook`,
    ``,
    link(
      "Gold outlook",
      "/outlook",
      "Current short- and long-term calls with rationale, key levels, invalidation levels, and cited sources.",
    ),
    link(
      "Gold price trends",
      "/trends",
      "Live gold spot price and an interactive 30-day chart.",
    ),
    ``,
    `## Calculators`,
    ``,
    link(FLAGSHIP_TOOL.name, FLAGSHIP_TOOL.href, FLAGSHIP_TOOL.description),
    ...TOOLS.map((tool) => link(tool.name, tool.href, tool.description)),
    ``,
    `## Insights`,
    ``,
    link(
      "All insights",
      "/insights",
      "The full archive of gold market explainers and updates, newest first.",
    ),
    ...INSIGHT_KINDS.map((kind) => link(kind.heading, kind.href, kind.description)),
    link("RSS feed", "/insights/rss.xml", "Every article, as RSS."),
    ``,
    ...(articles.length > 0
      ? [
          `### Articles`,
          ``,
          ...articles.map((a) =>
            link(a.title, `/insights/${a.slug}`, `${a.category} · ${a.description}`),
          ),
          ``,
        ]
      : []),
    `## How this site works`,
    ``,
    link(
      "Methodology",
      "/methodology",
      "Data sources, what the signals and confidence levels mean, cadence, and the calculator arithmetic.",
    ),
    link(
      "AI disclosure",
      "/ai-disclosure",
      "What the model drafts, what it never touches, how human review works, and the failure modes that remain.",
    ),
    link("About", "/about", "What GoldCompass is and who it is for."),
    link(
      "Disclaimer",
      "/disclaimer",
      "Educational-use-only terms, risk warnings, and our independence statement.",
    ),
    ``,
    `## API`,
    ``,
    `A public, versioned, CORS-enabled JSON API. No authentication, no API key. Responses are cache-friendly; please cache rather than poll.`,
    ``,
    link(
      "GET /api/v1/recommendations",
      "/api/v1/recommendations",
      "The current published outlook report — signals, confidence, key levels, sources.",
    ),
    link(
      "GET /api/v1/price",
      "/api/v1/price",
      "Current gold quote plus the 30-day series. Note the spot feed uses PAX Gold as a proxy, not the London fix.",
    ),
    link(
      "GET /api/v1/articles",
      "/api/v1/articles",
      "All published articles as summaries, without the body.",
    ),
    link(
      "GET /api/v1/articles/{slug}",
      "/api/v1/articles",
      "One article including its full Markdown body and sources.",
    ),
    ``,
  ];

  return sections.join("\n");
}

// ISR rather than fully static: the article list changes when a generated
// article is merged, and there is no purge-on-deploy at the edge (see
// CLAUDE.md 2026-07-27), so a static year-long TTL would go stale. Matches the
// /insights revalidation window.
export const revalidate = 3600;

export function GET(): Response {
  return new Response(buildBody(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
