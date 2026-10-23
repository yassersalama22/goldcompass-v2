import { getTranslations } from "next-intl/server";


import { ArticleCard } from "@/components/articles/article-card";
import { InsightFilterNav } from "@/components/articles/insight-filter-nav";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { INSIGHT_KINDS, insightKindCopy, type InsightKindDef } from "@/config/insight-kinds";
import { linkTag, richTags } from "@/i18n/rich";
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
export async function InsightKindView({
  def,
  locale,
}: {
  def: InsightKindDef;
  locale: string;
}) {
  const articles = getArticlesByKind(def.kind, locale);
  const other = INSIGHT_KINDS.find((k) => k.kind !== def.kind);
  const copy = insightKindCopy(def, locale);
  const otherCopy = other ? insightKindCopy(other, locale) : null;
  const t = await getTranslations("insights");
  const tb = await getTranslations("breadcrumb");
  const tn = await getTranslations("nav");

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: tb("home"), path: "/" },
          { name: tn("insights"), path: "/insights" },
          { name: copy.label, path: def.href },
        ], locale)}
      />

      <Container className="py-12 sm:py-16">
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{copy.heading}</h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{copy.intro}</p>
        </header>

        <InsightFilterNav current={def.slug} />

        {articles.length === 0 ? (
          <p className="text-muted-foreground">{t.rich("kindEmpty", richTags)}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={toArticleSummary(article)} />
            ))}
          </div>
        )}

        {other && otherCopy ? (
          <p className="text-muted-foreground mt-12 border-t pt-6 text-sm">
            {t.rich("lookingFor", {
              label: otherCopy.inlineLabel,
              heading: otherCopy.heading,
              other: linkTag(other.href),
            })}
          </p>
        ) : null}
      </Container>
    </>
  );
}

/** Shared metadata builder so both routes describe themselves identically. */
export function insightKindMetadata(def: InsightKindDef, locale: string) {
  const copy = insightKindCopy(def, locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: def.href },
    openGraph: {
      title: copy.heading,
      description: copy.description,
      url: def.href,
      type: "website" as const,
    },
  };
}
