import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Prose } from "@/components/markdown/prose";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, newsArticleSchema } from "@/lib/structured-data";
import { readingTimeMinutes } from "@/lib/reading-time";
import { getAllArticleSlugs, getArticleBySlug } from "@/server/articles";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Insight not found" };
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/insights/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      publishedTime: article.date,
      modifiedTime: article.updatedAt,
      tags: article.tags,
    },
  };
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const minutes = readingTimeMinutes(article.bodyMarkdown);

  return (
    <>
      <JsonLd
        data={[
          newsArticleSchema(article),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Insights", path: "/insights" },
            { name: article.title, path: `/insights/${article.slug}` },
          ]),
        ]}
      />

      <Container className="max-w-3xl py-12 sm:py-16">
        <Link
          href="/insights"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All insights
        </Link>

        <article className="space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{article.category}</Badge>
              <time dateTime={article.date} className="text-muted-foreground">
                {dateFormatter.format(new Date(article.date))}
              </time>
              <span className="text-muted-foreground">· {minutes} min read</span>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{article.title}</h1>
            <p className="text-muted-foreground text-lg text-pretty">
              {article.description}
            </p>
          </header>

          <Prose markdown={article.bodyMarkdown} />

          {article.sources.length > 0 ? (
            <section aria-labelledby="sources-heading" className="space-y-3 border-t pt-6">
              <h2 id="sources-heading" className="text-lg font-semibold">
                Sources
              </h2>
              <ul className="space-y-2">
                {article.sources.map((source) => (
                  <li key={source.url} className="text-sm">
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

          <p className="text-muted-foreground border-t pt-6 text-sm">
            Educational information only — not financial advice. See our{" "}
            <Link
              href="/disclaimer"
              className="text-gold-strong underline underline-offset-4"
            >
              disclaimer
            </Link>
            .
          </p>
        </article>
      </Container>
    </>
  );
}
