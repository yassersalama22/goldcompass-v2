import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

import { ArticleCard } from "@/components/articles/article-card";
import { InsightFilterNav } from "@/components/articles/insight-filter-nav";
import { Container } from "@/components/layout/container";
import { toArticleSummary } from "@/types/article";
import { getAllArticles } from "@/server/articles";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insights" });
  return withLocaleMetadata(
    { title: t("metaTitle"), description: t("metaDescription") },
    "/insights",
    locale,
  );
}

export default async function InsightsPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const articles = getAllArticles(locale);
  const t = await getTranslations("insights");

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("heading")}</h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          {t("lede")}
        </p>
      </header>

      <InsightFilterNav current="all" />

      {articles.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
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
