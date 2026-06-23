import type { Metadata } from "next";

import { ArticleCard } from "@/components/articles/article-card";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getAllArticles } from "@/server/articles";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Market Insights",
  description:
    "Gold-market insights — news summaries, analysis, and educational guides on prices, central banks, and the macro picture. Every claim cites a reputable source.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  const articles = getAllArticles();

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Market Insights</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          News summaries, market analysis, and educational guides on gold — what
          moved, why it matters, and where the data comes from. Every claim is
          tied to a cited source.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="text-muted-foreground">No insights published yet. Check back soon.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={toArticleSummary(article)} />
          ))}
        </div>
      )}
    </Container>
  );
}
