import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { linkTag, richTags } from "@/i18n/rich";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Num, Usd } from "@/components/market/num";
import { Container } from "@/components/layout/container";
import { Analysis } from "@/components/outlook/analysis";
import { KeyLevels } from "@/components/outlook/key-levels";
import { MacroPanel } from "@/components/outlook/macro-panel";
import { OutlookCallCard } from "@/components/outlook/outlook-call-card";
import { JsonLd } from "@/components/seo/json-ld";
import { SubscribeCta } from "@/components/newsletter/subscribe-cta";
import { formatLongDateTime, formatSignedPct } from "@/lib/format";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { outlookArticleSchema } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { DEFAULT_LOCALE } from "@/config/locales";
import { contentLangProps, outlookLocales } from "@/server/i18n/availability";
import { getPublishedOutlook, hasOutlookTranslation } from "@/server/outlook";

// ISR: re-render on a schedule; the pipeline will also trigger on-demand
// revalidation when a new outlook is published.
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const report = getPublishedOutlook(locale);
  const t = await getTranslations({ locale, namespace: "outlook" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: report?.summary ?? t("metaDescriptionFallback"),
      openGraph: {
        type: "article",
        title: t("ogTitle", { name: siteConfig.name }),
        description: report?.summary,
      },
    },
    "/outlook",
    locale,
    outlookLocales(),
    { ownImage: true },
  );
}

export default async function OutlookPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const report = getPublishedOutlook(locale);
  if (!report) notFound();
  const t = await getTranslations("outlook");
  const translated = locale === DEFAULT_LOCALE || hasOutlookTranslation(locale);
  const content = contentLangProps(translated, locale);
  const sourceLang = contentLangProps(false, locale);

  const change = report.spot.changePct;
  const ChangeIcon = change != null && change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <>
      <JsonLd data={outlookArticleSchema(report, translated ? locale : DEFAULT_LOCALE)} />

      <Container className="max-w-3xl py-12 sm:py-16">
        <article className="space-y-10">
          {/* Header */}
          <header className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("updated", { date: formatLongDateTime(report.updatedAt, locale) })}
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">{t("heading")}</h1>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tabular-nums">
                <Usd value={report.spot.price} />
              </span>
              <span className="text-muted-foreground text-sm">XAU/USD</span>
              {change != null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
                    change < 0 ? "text-bear" : "text-bull",
                  )}
                >
                  <ChangeIcon className="size-4" aria-hidden="true" />
                  <Num>{formatSignedPct(change)}</Num>
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-lg text-pretty" {...content}>
              {report.summary}
            </p>
          </header>

          {/* Key levels */}
          <section aria-labelledby="levels-heading" className="space-y-3">
            <h2 id="levels-heading" className="sr-only">
              {t("keyLevelsHeading")}
            </h2>
            <KeyLevels levels={report.keyLevels} content={content} />
          </section>

          {/* Recommendation cards */}
          <section aria-labelledby="calls-heading" className="space-y-4">
            <h2 id="calls-heading" className="text-2xl font-bold">
              {t("callsHeading")}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {report.calls.map((call) => (
                <OutlookCallCard key={call.term} call={call} content={content} />
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              {t.rich("convictionNote", {
                confidence: linkTag("/methodology#confidence"),
              })}
            </p>
          </section>

          {/* Macro backdrop — only when the artifact carries a snapshot */}
          {report.macro ? <MacroPanel macro={report.macro} content={content} /> : null}

          {/* Full analysis */}
          <section aria-labelledby="analysis-heading">
            <h2 id="analysis-heading" className="sr-only">
              {t("analysisHeading")}
            </h2>
            <Analysis markdown={report.analysisMarkdown} content={content} />
          </section>

          {/* Sources */}
          {report.sources.length > 0 ? (
            <section aria-labelledby="sources-heading" className="space-y-3">
              <h2 id="sources-heading" className="text-lg font-semibold">
                {t("sourcesHeading")}
              </h2>
              <ul className="space-y-2">
                {report.sources.map((source) => (
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

          {/* Methodology + disclaimer */}
          <section
            aria-labelledby="methodology-heading"
            className="bg-muted/40 space-y-2 rounded-lg border p-5 text-sm"
          >
            <h2 id="methodology-heading" className="font-semibold">
              {t("methodologyHeading")}
            </h2>
            <p className="text-muted-foreground">{t.rich("methodologyBody", richTags)}</p>
            <p className="text-muted-foreground">{t.rich("disclaimer", richTags)}</p>
          </section>

          <SubscribeCta source="outlook" />
        </article>
      </Container>
    </>
  );
}
