import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

import { ArticleCard } from "@/components/articles/article-card";
import { InsightFilterNav } from "@/components/articles/insight-filter-nav";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getAllArticles } from "@/server/articles";

export const revalidate = 3600;

const pageMetadata: Metadata = {
  title: "Market Insights",
  description:
    "Gold-market insights — news summaries, analysis, and educational guides on prices, central banks, and the macro picture. Every claim cites a reputable source.",
};

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/insights", locale);
}

export default async function InsightsPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const articles = getAllArticles(locale);

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Market Insights</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Everything we publish, newest first — market updates pegged to what
          just happened, and explainers built to stay true. Every claim is tied
          to a cited source.
        </p>
      </header>

      <InsightFilterNav current="all" />

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
