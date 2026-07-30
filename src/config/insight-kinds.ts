import type { ArticleKind } from "@/types/article";

/**
 * Presentation metadata for the two `/insights` sub-views. The contract owns
 * the enum (`articleKindSchema`); this owns the copy and the URLs, so page
 * wording never leaks into the data contract.
 *
 * `slug` values are reserved in `scripts/generate-article.mts` — they sit at
 * `/insights/<slug>`, the same level as article slugs, and a static route
 * silently wins over `[slug]`, which would make an article unreachable.
 */
export interface InsightKindDef {
  kind: ArticleKind;
  slug: string;
  href: string;
  /** Nav/filter label. */
  label: string;
  /** Page <h1>. */
  heading: string;
  /** Meta title (before the site-name template). */
  title: string;
  /** Meta description. */
  description: string;
  /** Lead paragraph — states the freshness contract for the view. */
  intro: string;
}

export const INSIGHT_KINDS: InsightKindDef[] = [
  {
    kind: "explainer",
    slug: "explainers",
    href: "/insights/explainers",
    label: "Explainers",
    heading: "Gold explainers",
    title: "Gold Explainers — How the Gold Market Actually Works",
    description:
      "Plain-English guides to what moves the gold price: interest rates, the dollar, central-bank demand, purity, and premiums. Written to stay true, and every claim cited.",
    intro:
      "The durable half of our writing: how the gold market works, explained for people who do not trade for a living. These pieces are about mechanisms rather than headlines, so they stay useful long after the week they were written.",
  },
  {
    kind: "market-update",
    slug: "market-updates",
    href: "/insights/market-updates",
    label: "Market updates",
    heading: "Gold market updates",
    title: "Gold Market Updates — What Moved the Price, and Why",
    description:
      "Timely coverage of the gold market: Fed decisions, inflation prints, geopolitics, and the moves they caused. Dated, cited, and written for everyday investors.",
    intro:
      "What happened, when, and why it mattered for gold. These are pegged to a moment — a rate decision, an inflation print, a geopolitical shock — so read the date first. For the mechanisms behind them, start with the explainers.",
  },
];

export function getInsightKind(slug: string): InsightKindDef | undefined {
  return INSIGHT_KINDS.find((k) => k.slug === slug);
}

/** Route segments under /insights that can never be used as an article slug. */
export const RESERVED_INSIGHT_SLUGS: string[] = [
  ...INSIGHT_KINDS.map((k) => k.slug),
  "rss.xml",
];
