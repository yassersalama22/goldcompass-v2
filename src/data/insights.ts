export type Insight = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** ISO date string. */
  date: string;
};

/**
 * Placeholder market-insight teasers for the home page. Real article content
 * arrives in Phase 4 (MDX). Keep these realistic but clearly editorial.
 */
export const featuredInsights: Insight[] = [
  {
    slug: "central-banks-keep-buying-gold",
    title: "Why central banks keep stacking gold",
    excerpt:
      "Official-sector demand has stayed elevated for a third straight year — here's what's driving it and why it matters for prices.",
    category: "Market Analysis",
    date: "2026-06-12",
  },
  {
    slug: "dollar-strength-and-gold",
    title: "The dollar–gold relationship, explained",
    excerpt:
      "A stronger dollar usually pressures gold. We break down the mechanics and when the correlation breaks down.",
    category: "Education",
    date: "2026-06-05",
  },
  {
    slug: "reading-gold-price-trends",
    title: "How to read short-term gold price trends",
    excerpt:
      "Spot price, premiums, and momentum: a practical guide to making sense of daily moves without overreacting.",
    category: "Guides",
    date: "2026-05-28",
  },
];
