import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { plainRichTags } from "@/i18n/rich";
import { Num } from "@/components/market/num";

import { BreakEvenCalculator } from "@/components/calculator/break-even-calculator";
import { ToolPageShell, type ToolFaq } from "@/components/calculator/tool-page-shell";
import { ToolSkeleton } from "@/components/calculator/tool-results";
import { getTool } from "@/config/tools";
import { breakEven } from "@/lib/calculator";
import { formatUsd } from "@/lib/format";
import { getGoldQuote } from "@/server/price";

export const revalidate = 300;

const tool = getTool("gold-break-even")!;

const FALLBACK_SPOT = 4150;


/**
 * Copy lives in the UI catalog under `tools.goldBreakEven.*` so it is pipeline-translated
 * with the glossary applied, rather than hand-written per locale.
 *
 * ⚠ The same array is rendered visibly AND passed to `faqSchema()` by
 * `ToolPageShell`. Google requires FAQ markup to match what a reader sees, so it
 * must stay ONE array built from ONE source — never two lists that can drift.
 */
function buildFaqs(t: (key: string) => string): ToolFaq[] {
  return Array.from({ length: 5 }, (_, i) => ({
    question: t(`faqs.q${i + 1}.question`),
    answer: t(`faqs.q${i + 1}.answer`),
  }));
}

function buildMistakes(t: (key: string) => string) {
  return Array.from({ length: 4 }, (_, i) => ({
    title: t(`mistakes.m${i + 1}.title`),
    body: t(`mistakes.m${i + 1}.body`),
  }));
}


export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tools.goldBreakEven.meta" });
  return withLocaleMetadata(
    {
      title: t("title"),
      description: t("description"),
      alternates: { canonical: tool.href },
      openGraph: {
        title: t("ogTitle"),
        description: t("ogDescription"),
        url: tool.href,
        type: "website",
      },
    },
    "/calculator/gold-break-even",
    locale,
  );
}

export default async function BreakEvenPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldBreakEven`);
  const ta = await getTranslations(`tools.goldBreakEven.about`);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const example = breakEven({ spotUsd: exampleSpot, premiumPct: 5, sellFeePct: 2 })!;
  const spotOnly = breakEven({ spotUsd: exampleSpot, premiumPct: 5, sellFeePct: 0 })!;

  return (
    <ToolPageShell
      locale={locale}
      tool={tool}
      intro={t("intro")}
      faqs={buildFaqs(t)}
      mistakes={buildMistakes(t)}
      about={
        <>
          <p>{ta("p1")}</p>
          <p className="bg-muted/60 border-border rounded-lg border px-4 py-3 font-mono text-sm">
            {ta("formula")}
          </p>
          <p>
            {ta.rich("p2", {
              ...plainRichTags,
              num: (chunks) => <Num>{chunks}</Num>,
              spot: formatUsd(exampleSpot, locale),
              cost: formatUsd(example.costPerPureTroyOz, locale),
              spotOnly: formatUsd(spotOnly.breakEvenSpot, locale),
              target: formatUsd(example.breakEvenSpot, locale),
              rise: `+${example.requiredRisePct.toFixed(1)}%`,
            })}
          </p>
          <p>{ta.rich("p3", plainRichTags)}</p>
          <p>{ta.rich("p4", plainRichTags)}</p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <BreakEvenCalculator initialSpot={initialSpot} isStale={priceResult.stale} />
      </Suspense>
    </ToolPageShell>
  );
}
