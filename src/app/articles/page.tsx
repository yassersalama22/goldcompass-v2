import type { Metadata } from "next";

import { ArticleCard } from "@/components/articles/article-card";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getAllArticles } from "@/server/articles";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Gold-market news summaries, analysis, and educational guides — each citing reputable sources.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Articles</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          News summaries, market analysis, and educational guides on gold — with
          every claim tied to a cited source.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="text-muted-foreground">No articles published yet. Check back soon.</p>
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
