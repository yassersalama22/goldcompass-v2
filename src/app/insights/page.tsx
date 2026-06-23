import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ArticleCard } from "@/components/articles/article-card";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getRecentArticles } from "@/server/articles";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Market Insights",
  description:
    "The latest gold-market insights — news summaries and analysis on prices, central banks, and the macro picture.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  const articles = getRecentArticles(6);

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Market Insights</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Our latest reads on the gold market — what moved, why it matters, and
          where the data comes from.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="text-muted-foreground">No insights published yet. Check back soon.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={toArticleSummary(article)} />
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/articles"
              className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              Browse all articles
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </Container>
  );
}
