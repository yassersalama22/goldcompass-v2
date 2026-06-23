import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ArticleCard } from "@/components/articles/article-card";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getRecentArticles } from "@/server/articles";

export function InsightsSection() {
  const articles = getRecentArticles(3);
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="insights-heading" className="py-16 sm:py-20">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 id="insights-heading" className="text-3xl font-bold">
              Market insights
            </h2>
            <p className="text-muted-foreground max-w-prose">
              Analysis on price moves, central banks, and what they mean for investors.
            </p>
          </div>
          <Link
            href="/insights"
            className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            All insights
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={toArticleSummary(article)} />
          ))}
        </div>
      </Container>
    </section>
  );
}
