import "server-only";

import { DEFAULT_LOCALE, localizePath } from "@/config/locales";
import { INSIGHT_KINDS, getInsightKind } from "@/config/insight-kinds";
import { FLAGSHIP_TOOL, TOOLS } from "@/config/tools";
import { siteConfig } from "@/config/site";
import { messages } from "@/i18n/messages";
import { formatSignedPct, formatUsd } from "@/lib/format";
import {
  getAllArticles,
  getArticleBySlug,
  getArticlesByKind,
  getRecentArticles,
} from "@/server/articles";
import { getPage } from "@/server/pages";
import { getGoldQuote, getGoldSeries30d } from "@/server/price";
import { getPublishedOutlook } from "@/server/outlook";
import type { Article } from "@/types/article";
import type { MacroSnapshot } from "@/types/macro";
import type { OutlookReport } from "@/types/outlook";

/**
 * Markdown representations of the content routes, for `Accept: text/markdown`.
 *
 * Every document here is generated from the same data-access layer the HTML
 * pages read (§4 headless core), so a Markdown response can never disagree with
 * the page it represents. Crucially, the outlook analysis and article bodies are
 * *already* Markdown in their artifacts — we emit the source text rather than
 * converting rendered HTML back to Markdown the way an edge converter would.
 *
 * Routes with no Markdown source deliberately have no builder here; see
 * `hasMarkdownRepresentation` in `src/lib/agent-markdown.ts`.
 */

const { url: SITE } = siteConfig;

/**
 * Absolute URL for a locale-independent *page* path.
 *
 * Only the HTML routes are localized. `/api/v1/*` and `/llms.txt` live outside
 * the `[locale]` tree and are deliberately left unprefixed below — an agent
 * following `${SITE}/ar/api/v1/price` would get a 404.
 */
function page(path: string, locale: string): string {
  return `${SITE}${localizePath(path, locale)}`;
}

function disclaimer(locale: string): string {
  return (
    "Educational content only. Nothing here is financial advice, no investment " +
    "products are sold, and GoldCompass takes no commissions. Gold can lose " +
    "value. See " +
    `${page("/disclaimer", locale)}.`
  );
}

function aiNote(locale: string): string {
  return (
    "Analysis is drafted by a large language model against deterministic market " +
    `data and reviewed by a human before publication (${page("/ai-disclosure", locale)}). ` +
    `Spot is proxied by PAX Gold (PAXG), not the London fix (${page("/methodology", locale)}).`
  );
}

/*
 * Money in these documents is formatted at the canonical locale on purpose, so
 * it reads `$4,283.61` regardless of the requested language. This is the
 * machine-facing representation: it already spells the ISO code out separately
 * ("… USD per troy ounce", "Price (USD)"), so appending a localized unit word
 * would give an agent `4,283.61 دولار USD`. Prose bodies get translated in
 * Phase C; the figures stay in the unambiguous form.
 */

/** Escape the one character that would break a Markdown table cell. */
function cell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}

/** Trailing block every document ends with, so a cited excerpt carries context. */
function footer(canonicalPath: string, locale: string): string {
  return [
    "---",
    "",
    `**Canonical HTML page:** ${page(canonicalPath, locale)}`,
    "",
    disclaimer(locale),
  ].join("\n");
}

function sourcesSection(sources: { title: string; url: string }[]): string[] {
  if (sources.length === 0) return [];
  return [
    "## Sources",
    "",
    ...sources.map((s) => `- [${s.title}](${s.url})`),
    "",
  ];
}

/**
 * Mirrors `pressure()` in `components/outlook/macro-panel.tsx`: the direction of
 * pressure on gold, not the direction of the indicator — a *falling* headwind is
 * supportive. Kept in step with the panel so the two representations of the same
 * snapshot cannot tell different stories.
 */
function macroPressure(indicator: MacroSnapshot["indicators"][number]): string {
  if (indicator.change30d === null) return "unchanged";
  const threshold = indicator.unit === "percent" ? 0.05 : 0.25;
  if (Math.abs(indicator.change30d) < threshold) return "neutral";
  const rising = indicator.change30d > 0;
  return rising === (indicator.goldEffect === "headwind")
    ? "restrictive"
    : "supportive";
}

function macroSection(macro: MacroSnapshot): string[] {
  const rows = macro.indicators.map((indicator) => {
    const value =
      indicator.unit === "percent"
        ? `${indicator.value.toFixed(2)}%`
        : indicator.value.toFixed(1);
    // Yields move in percentage *points*; a "%" suffix would imply a relative
    // move (the same distinction the HTML panel makes).
    const suffix = indicator.unit === "percent" ? " pp" : "";
    const change =
      indicator.change30d === null
        ? "n/a"
        : `${indicator.change30d > 0 ? "+" : ""}${indicator.change30d.toFixed(2)}${suffix}`;
    return [
      indicator.label,
      value,
      change,
      macroPressure(indicator),
      indicator.asOf,
    ];
  });

  return [
    "## Macro backdrop",
    "",
    "The deterministic data the analysis above reasoned over — snapshotted at",
    "generation time, not fetched live, so these are provably the numbers behind",
    "the calls. A stronger dollar and higher real yields are headwinds for gold;",
    "rising inflation expectations are a tailwind. \"Pressure\" is the direction of",
    "pressure on gold over the last 30 days, so a *falling* headwind reads as",
    "supportive.",
    "",
    table(
      ["Indicator", "Latest", "30-day change", "Pressure on gold", "As of"],
      rows,
    ),
    "",
    // `macro.source` already begins with "Source:" — required attribution, kept
    // verbatim rather than reformatted.
    `${macro.source}. The dollar figure is the Federal Reserve's trade-weighted`,
    `broad dollar index, NOT the ICE "DXY", which is proprietary. The inflation`,
    "breakeven is derived as the 10-year Treasury yield minus the 10-year real",
    "yield.",
    "",
  ];
}

function spotLine(report: OutlookReport): string {
  const change =
    report.spot.changePct === undefined
      ? ""
      : ` (${formatSignedPct(report.spot.changePct)})`;
  return `Gold spot is **${formatUsd(report.spot.price)} ${report.spot.currency} per troy ounce**${change}, as of ${report.spot.asOf}.`;
}

function callsSection(report: OutlookReport): string[] {
  const lines: string[] = ["## Calls", ""];
  for (const call of report.calls) {
    lines.push(
      `### ${call.label} — ${call.horizon}`,
      "",
      `- **Signal:** ${call.signal}`,
      `- **Confidence:** ${call.confidence}`,
      `- **Rationale:** ${call.reason}`,
    );
    if (call.invalidation) {
      lines.push(`- **Invalidation:** ${call.invalidation}`);
    }
    lines.push("");
  }
  // Confidence is about evidence strength, not the probability of the outcome —
  // stated here because an agent quoting "high confidence" out of context would
  // otherwise imply a likelihood we never claimed.
  lines.push(
    "Confidence describes how strong the supporting evidence is, not the",
    "probability that the call is right. The invalidation level is what would",
    "prove the view wrong.",
    "",
  );
  return lines;
}

function buildOutlook(locale: string): string | null {
  const report = getPublishedOutlook(locale);
  if (!report) return null;

  return [
    "# Gold Market Outlook",
    "",
    `> ${report.summary}`,
    "",
    `**Date:** ${report.date}  `,
    `**Last updated:** ${report.updatedAt}  `,
    `**Origin:** ${report.origin === "generated" ? "AI-drafted, human-reviewed" : "Editorial"}`,
    "",
    spotLine(report),
    "",
    ...callsSection(report),
    ...(report.keyLevels.length > 0
      ? [
          "## Key levels",
          "",
          table(
            ["Level", "Value"],
            report.keyLevels.map((level) => [level.label, level.value]),
          ),
          "",
        ]
      : []),
    ...(report.macro ? macroSection(report.macro) : []),
    "## Analysis",
    "",
    report.analysisMarkdown.trim(),
    "",
    ...sourcesSection(report.sources),
    "## How this was produced",
    "",
    aiNote(locale),
    "",
    footer("/outlook", locale),
  ].join("\n");
}

async function buildTrends(locale: string): Promise<string> {
  const [quote, series] = await Promise.all([
    getGoldQuote(),
    getGoldSeries30d(),
  ]);

  const lines: string[] = [
    "# Gold Price Trends (XAU/USD)",
    "",
    "> Live gold spot price and the last 30 days of daily closes.",
    "",
  ];

  if (quote.data) {
    const change =
      quote.data.changePct24h === null
        ? ""
        : ` (${formatSignedPct(quote.data.changePct24h)} over 24h)`;
    lines.push(
      `**Spot:** ${formatUsd(quote.data.price)} ${quote.data.currency} per troy ounce${change}  `,
      `**As of:** ${quote.data.asOf}  `,
      `**Source:** ${quote.data.source}`,
      "",
    );
  } else {
    lines.push(
      "The live quote is temporarily unavailable — the upstream price feed did",
      "not respond. Retry shortly rather than treating this as a zero.",
      "",
    );
  }

  const points = series.data?.points ?? [];
  if (points.length > 0) {
    const prices = points.map((p) => p.price);
    const first = prices[0]!;
    const last = prices[prices.length - 1]!;
    const changePct = ((last - first) / first) * 100;

    lines.push(
      "## 30-day summary",
      "",
      table(
        ["Metric", "Value"],
        [
          ["Period high", formatUsd(Math.max(...prices))],
          ["Period low", formatUsd(Math.min(...prices))],
          ["30 days ago", formatUsd(first)],
          ["Latest close", formatUsd(last)],
          ["Change over period", formatSignedPct(changePct)],
        ],
      ),
      "",
      "## Daily closes",
      "",
      table(
        ["Date (UTC)", "Close (USD/ozt)"],
        points.map((p) => [
          new Date(p.t).toISOString().slice(0, 10),
          formatUsd(p.price),
        ]),
      ),
      "",
    );
  }

  lines.push(
    "## Note on the price source",
    "",
    "Spot is proxied by PAX Gold (PAXG), a token redeemable for allocated gold,",
    "not the LBMA London fix. It tracks spot closely but is not the benchmark",
    `price — see ${page("/methodology", locale)}.`,
    "",
    footer("/trends", locale),
  );

  return lines.join("\n");
}

function articleLine(article: Article, locale: string): string {
  return `- **[${article.title}](${page(`/insights/${article.slug}`, locale)})** — ${article.description}  \n  *${article.category} · ${article.kind === "explainer" ? "Explainer" : "Market update"} · ${article.date}*`;
}

function buildArticleList(
  heading: string,
  intro: string,
  articles: Article[],
  canonicalPath: string,
  locale: string,
): string {
  return [
    `# ${heading}`,
    "",
    `> ${intro}`,
    "",
    articles.length > 0
      ? `${articles.length} published article${articles.length === 1 ? "" : "s"}, newest first.`
      : "No articles are published yet.",
    "",
    ...articles.map((article) => articleLine(article, locale)),
    "",
    "## Related",
    "",
    ...INSIGHT_KINDS.filter((k) => k.href !== canonicalPath).map(
      (k) => `- [${k.heading}](${page(k.href, locale)}) — ${k.description}`,
    ),
    `- [RSS feed](${page("/insights/rss.xml", locale)})`,
    `- [All articles as JSON](${SITE}/api/v1/articles)`,
    "",
    footer(canonicalPath, locale),
  ].join("\n");
}

function buildArticle(slug: string, locale: string): string | null {
  const article = getArticleBySlug(slug, locale);
  if (!article) return null;

  // Joined with a hard line break so the metadata renders as one block of
  // separate lines rather than a single run-on paragraph.
  const meta = [
    `**Published:** ${article.date}`,
    `**Last updated:** ${article.updatedAt}`,
    `**Category:** ${article.category}`,
    `**Type:** ${article.kind === "explainer" ? "Explainer (written to stay true)" : "Market update (pegged to its date)"}`,
    `**Origin:** ${article.origin === "generated" ? "AI-drafted, human-reviewed" : "Editorial"}`,
    ...(article.tags.length > 0 ? [`**Tags:** ${article.tags.join(", ")}`] : []),
  ];

  return [
    `# ${article.title}`,
    "",
    `> ${article.description}`,
    "",
    meta.join("  \n"),
    "",
    article.bodyMarkdown.trim(),
    "",
    ...sourcesSection(article.sources),
    ...(article.origin === "generated"
      ? ["## How this was produced", "", aiNote(locale), ""]
      : []),
    footer(`/insights/${article.slug}`, locale),
  ].join("\n");
}

/**
 * A static prose page. The body is already Markdown in its artifact, so this
 * emits the source rather than converting rendered HTML back — the same property
 * that makes the outlook and article representations lossless.
 */
function buildProsePage(slug: string, locale: string): string {
  const page = getPage(slug, locale);
  return [
    `# ${page.heading}`,
    "",
    ...(page.lede ? [`> ${page.lede}`, ""] : []),
    `*Last updated: ${page.updatedAt}*`,
    "",
    page.bodyMarkdown,
    "",
    footer(`/${slug}`, locale),
  ].join("\n");
}

function buildHome(locale: string): string {
  const report = getPublishedOutlook(locale);
  const articles = getRecentArticles(5, locale);

  const lines: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${messages(locale).site.shortDescription}`,
    "",
    "GoldCompass publishes a short-term (weeks) and long-term (months) view on",
    "gold, each with a signal, a confidence level, and an invalidation level that",
    "says what would prove it wrong — plus live price trends, calculators for",
    "physical gold purchases, and cited market analysis. Written for people",
    "buying physical gold, not for leveraged traders.",
    "",
  ];

  if (report) {
    lines.push(
      "## Current outlook",
      "",
      spotLine(report),
      "",
      table(
        ["Horizon", "Signal", "Confidence", "Invalidation"],
        report.calls.map((call) => [
          `${call.label} (${call.horizon})`,
          call.signal,
          call.confidence,
          call.invalidation ?? "—",
        ]),
      ),
      "",
      report.summary,
      "",
      `Full analysis, key levels, and sources: ${page("/outlook", locale)}`,
      "",
    );
  }

  if (articles.length > 0) {
    lines.push(
      "## Latest insights",
      "",
      ...articles.map((article) => articleLine(article, locale)),
      "",
    );
  }

  lines.push(
    "## Calculators",
    "",
    `- [${FLAGSHIP_TOOL.name}](${page(FLAGSHIP_TOOL.href, locale)}) — ${FLAGSHIP_TOOL.description}`,
    ...TOOLS.map((t) => `- [${t.name}](${page(t.href, locale)}) — ${t.description}`),
    "",
    "## How this site works",
    "",
    `- [Methodology](${page("/methodology", locale)}) — data sources, what the signals mean, cadence, calculator arithmetic.`,
    `- [AI disclosure](${page("/ai-disclosure", locale)}) — what the model drafts, what it never touches, and the failure modes that remain.`,
    `- [About](${page("/about", locale)}) · [Disclaimer](${page("/disclaimer", locale)})`,
    "",
    "## Machine-readable endpoints",
    "",
    "A public, versioned, CORS-enabled JSON API. No authentication. Please cache",
    "rather than poll.",
    "",
    `- \`GET ${SITE}/api/v1/recommendations\` — the current published outlook.`,
    `- \`GET ${SITE}/api/v1/price\` — current quote plus the 30-day series.`,
    `- \`GET ${SITE}/api/v1/articles\` — published articles as summaries.`,
    `- \`GET ${SITE}/api/v1/articles/{slug}\` — one article with its Markdown body.`,
    `- \`GET ${SITE}/llms.txt\` — this site map, as plain text.`,
    "",
    footer("/", locale),
  );

  return lines.join("\n");
}

/**
 * Render `pathname` as Markdown, or `null` when there is nothing to serve
 * (an article slug that does not exist). The caller turns `null` into a 404.
 */
export async function buildMarkdown(
  pathname: string,
  locale: string = DEFAULT_LOCALE,
): Promise<string | null> {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  switch (path) {
    case "/":
      return buildHome(locale);
    case "/outlook":
      return buildOutlook(locale);
    case "/trends":
      return buildTrends(locale);
    case "/disclaimer":
      return buildProsePage("disclaimer", locale);
    case "/insights":
      return buildArticleList(
        "Gold market insights",
        "Explainers and market updates on gold, written for everyday investors and cited throughout.",
        getAllArticles(locale),
        "/insights",
        locale,
      );
  }

  const kindSlug = /^\/insights\/([a-z0-9-]+)$/.exec(path)?.[1];
  if (!kindSlug) return null;

  const kind = getInsightKind(kindSlug);
  if (kind) {
    return buildArticleList(
      kind.heading,
      kind.intro,
      getArticlesByKind(kind.kind, locale),
      kind.href,
      locale,
    );
  }

  return buildArticle(kindSlug, locale);
}
