import { Link } from "@/i18n/navigation";

import { ArticleCard } from "@/components/articles/article-card";
import { InsightFilterNav } from "@/components/articles/insight-filter-nav";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { INSIGHT_KINDS, type InsightKindDef } from "@/config/insight-kinds";
import { breadcrumbSchema } from "@/lib/structured-data";
import { getArticlesByKind } from "@/server/articles";
import { toArticleSummary } from "@/types/article";

/**
 * Body of both `/insights/explainers` and `/insights/market-updates`.
 *
 * They are static route folders rather than one dynamic segment because
 * `/insights/[slug]` already occupies this level, and Next.js allows only one
 * dynamic slug name per level. Static segments also win over `[slug]` in
 * routing, which is what keeps these URLs from being read as article slugs.
 */
export function InsightKindView({
  def,
  locale,
}: {
  def: InsightKindDef;
  locale: string;
}) {
  const articles = getArticlesByKind(def.kind);
  const other = INSIGHT_KINDS.find((k) => k.kind !== def.kind);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Insights", path: "/insights" },
          { name: def.label, path: def.href },
        ], locale)}
      />

      <Container className="py-12 sm:py-16">
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{def.heading}</h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{def.intro}</p>
        </header>

        <InsightFilterNav current={def.slug} />

        {articles.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing published here yet.{" "}
            <Link href="/insights" className="text-gold-strong underline underline-offset-4">
              Browse all insights
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={toArticleSummary(article)} />
            ))}
          </div>
        )}

        {other ? (
          <p className="text-muted-foreground mt-12 border-t pt-6 text-sm">
            Looking for {other.label.toLowerCase()} instead?{" "}
            <Link href={other.href} className="text-gold-strong underline underline-offset-4">
              {other.heading}
            </Link>
            .
          </p>
        ) : null}
      </Container>
    </>
  );
}

/** Shared metadata builder so both routes describe themselves identically. */
export function insightKindMetadata(def: InsightKindDef) {
  return {
    title: def.title,
    description: def.description,
    alternates: { canonical: def.href },
    openGraph: {
      title: def.heading,
      description: def.description,
      url: def.href,
      type: "website" as const,
    },
  };
}
