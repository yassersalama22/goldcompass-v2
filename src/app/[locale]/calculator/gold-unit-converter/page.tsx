import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

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

const pageMetadata: Metadata = {
  title: "Gold Unit Converter — Grams, Troy Ounces, Tola & Pennyweight",
  description:
    "Convert gold weights between grams, kilograms, troy ounces, ounces, pennyweight, and tola — and see what each unit is worth at today's live gold price.",
  alternates: { canonical: tool.href },
  openGraph: {
    title: "Gold Unit Converter",
    description:
      "Convert gold between grams, troy ounces, tola, and pennyweight, with the live value of each.",
    url: tool.href,
    type: "website",
  },
};

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
  return withLocaleMetadata(pageMetadata, "/calculator/gold-unit-converter", locale);
}

export default async function UnitConverterPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldUnitConverter`);

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
          <p>
            Every conversion here routes through grams as the base unit, so nothing is converted
            twice and no rounding compounds:
          </p>
          <ul className="marker:text-gold-strong list-disc space-y-1 ps-6">
            <li>1 troy ounce (ozt) = 31.1035 g</li>
            <li>1 ounce, avoirdupois (oz) = 28.349523125 g</li>
            <li>1 pennyweight (dwt) = 1.55517384 g = 1/20 troy oz</li>
            <li>1 tola = 11.6638038 g</li>
            <li>1 kilogram = 1,000 g = 32.1507 troy oz</li>
          </ul>
          <p>
            <strong>Worked example.</strong> At a spot price of{" "}
            <strong>{formatUsd(exampleSpot, locale)}</strong> per troy ounce, pure gold is worth{" "}
            <strong>{formatUsd(perGram, locale)}</strong> per gram. A 1 kg bar therefore holds 32.15 troy
            ounces and is worth about <strong>{formatUsd(perGram * 1000, locale)}</strong>, while a single
            pennyweight of pure gold is worth <strong>{formatUsd(perGram * 1.55517384, locale)}</strong>.
          </p>
          <p>
            Selecting a purity changes only the value columns, never the weights. Values shown are
            pure gold content at spot, with no dealer premium — for what a dealer would charge on
            top, use the{" "}
            <Link
              href="/calculator/gold-break-even"
              className="text-gold-strong underline underline-offset-4"
            >
              break-even calculator
            </Link>
            , and for what a specific karat is worth per gram, use the{" "}
            <Link
              href="/calculator/gold-karat-price"
              className="text-gold-strong underline underline-offset-4"
            >
              karat price calculator
            </Link>
            .
          </p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <UnitConverter initialSpot={initialSpot} isStale={priceResult.stale} />
      </Suspense>
    </ToolPageShell>
  );
}
