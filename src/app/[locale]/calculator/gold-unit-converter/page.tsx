import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { plainRichTags } from "@/i18n/rich";

import { UnitConverter } from "@/components/calculator/unit-converter";
import { ToolPageShell, type ToolFaq } from "@/components/calculator/tool-page-shell";
import { ToolSkeleton } from "@/components/calculator/tool-results";
import { getTool } from "@/config/tools";
import { TROY_OZ_TO_GRAMS } from "@/lib/calculator";
import { formatUsd } from "@/lib/format";
import { getGoldQuote } from "@/server/price";

export const revalidate = 300;

const tool = getTool("gold-unit-converter")!;

const FALLBACK_SPOT = 4150;


/**
 * Copy lives in the UI catalog under `tools.goldUnitConverter.*` so it is pipeline-translated
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
  const t = await getTranslations({ locale, namespace: "tools.goldUnitConverter.meta" });
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
    "/calculator/gold-unit-converter",
    locale,
  );
}

export default async function UnitConverterPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldUnitConverter`);
  const ta = await getTranslations(`tools.goldUnitConverter.about`);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const perGram = exampleSpot / TROY_OZ_TO_GRAMS;

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
          <ul className="marker:text-gold-strong list-disc space-y-1 ps-6">
            {(["l1", "l2", "l3", "l4", "l5"] as const).map((key) => (
              <li key={key}>{ta(`list.${key}`)}</li>
            ))}
          </ul>
          <p>
            {ta.rich("p2", {
              ...plainRichTags,
              spot: formatUsd(exampleSpot, locale),
              perGram: formatUsd(perGram, locale),
              kgValue: formatUsd(perGram * 1000, locale),
              dwtValue: formatUsd(perGram * 1.55517384, locale),
            })}
          </p>
          <p>{ta.rich("p3", plainRichTags)}</p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <UnitConverter initialSpot={initialSpot} isStale={priceResult.stale} />
      </Suspense>
    </ToolPageShell>
  );
}
