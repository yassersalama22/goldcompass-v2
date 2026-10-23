import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { richTags } from "@/i18n/rich";

import { Container } from "@/components/layout/container";
import { Prose } from "@/components/markdown/prose";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/seo/json-ld";
import { SubscribeCta } from "@/components/newsletter/subscribe-cta";
import { DEFAULT_LOCALE } from "@/config/locales";
import { articleLocales, contentLangProps } from "@/server/i18n/availability";
import { formatLongDate } from "@/lib/format";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { breadcrumbSchema, newsArticleSchema } from "@/lib/structured-data";
import { readingTimeMinutes } from "@/lib/reading-time";
import { getAllArticleSlugs, getArticleBySlug, isArticleTranslated } from "@/server/articles";

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Slugs are locale-independent by design (CLAUDE.md: a translated article keeps
 * the English slug), so this returns the same set for every locale and Next
 * crosses it with the `[locale]` params from the layout.
 */
export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: LocaleParams & { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticleBySlug(slug, locale);
  if (!article) {
    const t = await getTranslations({ locale, namespace: "insights.article" });
    return { title: t("notFoundTitle") };
  }

  // Only locales with a CURRENT translation are advertised. An untranslated
  // article still renders under /ar/ (English, labelled as such), but its
  // canonical points at the English page and it claims no Arabic hreflang.
  return withLocaleMetadata(
    {
      title: article.title,
      description: article.description,
      openGraph: {
        type: "article",
        title: article.title,
        description: article.description,
        publishedTime: article.date,
        modifiedTime: article.updatedAt,
        tags: article.tags,
      },
    },
    `/insights/${article.slug}`,
    locale,
    articleLocales(article.slug),
    { ownImage: true },
  );
}

export default async function InsightPage({
  params,
}: LocaleParams & { params: Promise<{ slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = getArticleBySlug(slug, locale);
  if (!article) notFound();

  const minutes = readingTimeMinutes(article.bodyMarkdown);
  const translated = isArticleTranslated(article.slug, locale);
  // Fallback English inside an /ar page: marked as English, laid out LTR.
  const content = contentLangProps(translated, locale);
  // Source titles are never translated, so they are English on every locale.
  const sourceLang = contentLangProps(false, locale);
  const t = await getTranslations("insights");
  const tb = await getTranslations("breadcrumb");
  const tn = await getTranslations("nav");

  return (
    <>
      <JsonLd
        data={[
          // A fallback page describes the English article: English URL, inLanguage "en".
          newsArticleSchema(article, translated ? locale : DEFAULT_LOCALE),
          breadcrumbSchema([
            { name: tb("home"), path: "/" },
            { name: tn("insights"), path: "/insights" },
            { name: article.title, path: `/insights/${article.slug}` },
          ], locale),
        ]}
      />

      <Container className="max-w-3xl py-12 sm:py-16">
        <Link
          href="/insights"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="rtl:rotate-180 size-4" aria-hidden="true" />
          {t("all")}
        </Link>

        <article className="space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary" {...content}>
                {article.category}
              </Badge>
              <time dateTime={article.date} className="text-muted-foreground">
                {formatLongDate(article.date, locale)}
              </time>
              <span className="text-muted-foreground">
                {/* `count` selects the plural form; `minutes` is passed as a
                    string so ICU does not format it with the page locale —
                    plain "ar" would render Arabic-Indic digits. */}
                · {t("article.readingTime", { count: minutes, minutes: String(minutes) })}
              </span>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl" {...content}>
              {article.title}
            </h1>
            <p className="text-muted-foreground text-lg text-pretty" {...content}>
              {article.description}
            </p>
          </header>

          <div {...content}>
            <Prose markdown={article.bodyMarkdown} />
          </div>

          {article.sources.length > 0 ? (
            <section aria-labelledby="sources-heading" className="space-y-3 border-t pt-6">
              <h2 id="sources-heading" className="text-lg font-semibold">
                {t("article.sourcesHeading")}
              </h2>
              <ul className="space-y-2">
                {article.sources.map((source) => (
                  <li key={source.url} className="text-sm" {...sourceLang}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-gold-strong underline underline-offset-4"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <SubscribeCta source="insight" />

          <p className="text-muted-foreground border-t pt-6 text-sm">
            {t.rich("article.disclaimer", richTags)}
          </p>
        </article>
      </Container>
    </>
  );
}
