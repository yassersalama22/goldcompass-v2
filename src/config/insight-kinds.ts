import { messages } from "@/i18n/messages";
import type { ArticleKind } from "@/types/article";

/**
 * Structure of the two `/insights` sub-views. The contract owns the enum
 * (`articleKindSchema`), this owns the URLs, and the UI catalog owns the copy
 * (`insights.kinds.*`) so it is translatable — page wording never leaks into
 * the data contract.
 *
 * `slug` values are reserved in `scripts/generate-article.mts` — they sit at
 * `/insights/<slug>`, the same level as article slugs, and a static route
 * silently wins over `[slug]`, which would make an article unreachable.
 */
export interface InsightKindDef {
  kind: ArticleKind;
  slug: string;
  href: string;
  /** Key under `insights.kinds.*` in the UI catalog, where all the copy lives. */
  messageKey: "explainers" | "marketUpdates";
}

/** The copy for a kind view, in one locale. */
export interface InsightKindCopy {
  /** Nav/filter label. */
  label: string;
  /** The label as it reads mid-sentence ("Looking for explainers instead?"). */
  inlineLabel: string;
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
  { kind: "explainer", slug: "explainers", href: "/insights/explainers", messageKey: "explainers" },
  {
    kind: "market-update",
    slug: "market-updates",
    href: "/insights/market-updates",
    messageKey: "marketUpdates",
  },
];

/**
 * Copy for a kind view. Read through the sync `messages()` accessor rather than
 * `getTranslations()` because three of its callers run outside a React render:
 * the Markdown builder, `llms.txt`, and metadata builders.
 */
export function insightKindCopy(def: InsightKindDef, locale: string): InsightKindCopy {
  return messages(locale).insights.kinds[def.messageKey];
}

export function getInsightKind(slug: string): InsightKindDef | undefined {
  return INSIGHT_KINDS.find((k) => k.slug === slug);
}

/** Route segments under /insights that can never be used as an article slug. */
export const RESERVED_INSIGHT_SLUGS: string[] = [
  ...INSIGHT_KINDS.map((k) => k.slug),
  "rss.xml",
];
