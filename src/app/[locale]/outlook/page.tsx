import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Num } from "@/components/market/num";
import { Container } from "@/components/layout/container";
import { Analysis } from "@/components/outlook/analysis";
import { KeyLevels } from "@/components/outlook/key-levels";
import { MacroPanel } from "@/components/outlook/macro-panel";
import { OutlookCallCard } from "@/components/outlook/outlook-call-card";
import { JsonLd } from "@/components/seo/json-ld";
import { SubscribeCta } from "@/components/newsletter/subscribe-cta";
import { formatLongDateTime, formatSignedPct, formatUsd } from "@/lib/format";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { outlookArticleSchema } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { getPublishedOutlook } from "@/server/outlook";

// ISR: re-render on a schedule; the pipeline will also trigger on-demand
// revalidation when a new outlook is published.
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const report = getPublishedOutlook(locale);
  return withLocaleMetadata(
    {
      title: "Gold Market Outlook",
      description:
        report?.summary ??
        "Short-term and long-term gold market outlooks with supporting analysis.",
      openGraph: {
        type: "article",
        title: "Gold Market Outlook · GoldCompass",
        description: report?.summary,
      },
    },
    "/outlook",
    locale,
  );
}

export default async function OutlookPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const report = getPublishedOutlook(locale);
  if (!report) notFound();

  const change = report.spot.changePct;
  const ChangeIcon = change != null && change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <>
      <JsonLd data={outlookArticleSchema(report, locale)} />

      <Container className="max-w-3xl py-12 sm:py-16">
        <article className="space-y-10">
          {/* Header */}
          <header className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Updated {formatLongDateTime(report.updatedAt, locale)} UTC
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">Gold Market Outlook</h1>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tabular-nums">
                <Num>{formatUsd(report.spot.price, locale)}</Num>
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
            <p className="text-muted-foreground text-lg text-pretty">
              {report.summary}
            </p>
          </header>

          {/* Key levels */}
          <section aria-labelledby="levels-heading" className="space-y-3">
            <h2 id="levels-heading" className="sr-only">
              Key price levels
            </h2>
            <KeyLevels levels={report.keyLevels} />
          </section>

          {/* Recommendation cards */}
          <section aria-labelledby="calls-heading" className="space-y-4">
            <h2 id="calls-heading" className="text-2xl font-bold">
              Our recommendations
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {report.calls.map((call) => (
                <OutlookCallCard key={call.term} call={call} />
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              Conviction describes how strongly the evidence supports the call — not how likely
              the outcome is.{" "}
              <Link
                href="/methodology#confidence"
                className="text-gold-strong underline underline-offset-4"
              >
                How we set it
              </Link>
              .
            </p>
          </section>

          {/* Macro backdrop — only when the artifact carries a snapshot */}
          {report.macro ? <MacroPanel macro={report.macro} /> : null}

          {/* Full analysis */}
          <section aria-labelledby="analysis-heading">
            <h2 id="analysis-heading" className="sr-only">
              Full analysis
            </h2>
            <Analysis markdown={report.analysisMarkdown} />
          </section>

          {/* Sources */}
          {report.sources.length > 0 ? (
            <section aria-labelledby="sources-heading" className="space-y-3">
              <h2 id="sources-heading" className="text-lg font-semibold">
                Sources
              </h2>
              <ul className="space-y-2">
                {report.sources.map((source) => (
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

          {/* Methodology + disclaimer */}
          <section
            aria-labelledby="methodology-heading"
            className="bg-muted/40 space-y-2 rounded-lg border p-5 text-sm"
          >
            <h2 id="methodology-heading" className="font-semibold">
              How we form this view
            </h2>
            <p className="text-muted-foreground">
              Our outlook combines live market data (spot price and momentum)
              with analysis of the key macro drivers — the US dollar, real
              yields, central-bank demand, and positioning. The analysis is
              AI-drafted on top of that data and reviewed by a human before it
              publishes; the price figures are fetched from a market data
              source, never generated. Read our{" "}
              <Link
                href="/methodology"
                className="text-gold-strong underline underline-offset-4"
              >
                full methodology
              </Link>{" "}
              for the sources, the review process, and the limitations.
            </p>
            <p className="text-muted-foreground">
              This is educational information only and{" "}
              <strong className="text-foreground">not financial advice</strong>.
              See our{" "}
              <Link
                href="/disclaimer"
                className="text-gold-strong underline underline-offset-4"
              >
                full disclaimer
              </Link>
              .
            </p>
          </section>

          <SubscribeCta source="outlook" />
        </article>
      </Container>
    </>
  );
}
