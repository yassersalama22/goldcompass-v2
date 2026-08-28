import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

import { KaratPriceCalculator } from "@/components/calculator/karat-price-calculator";
import { ToolPageShell, type ToolFaq } from "@/components/calculator/tool-page-shell";
import { ToolSkeleton } from "@/components/calculator/tool-results";
import { getTool } from "@/config/tools";
import { TROY_OZ_TO_GRAMS, purityFactorFor } from "@/lib/calculator";
import { formatUsd } from "@/lib/format";
import { getGoldQuote } from "@/server/price";

export const revalidate = 300;

const tool = getTool("gold-karat-price")!;

/** Used for the worked example only when the live quote is unavailable. */
const FALLBACK_SPOT = 4150;

const pageMetadata: Metadata = {
  title: "Gold Karat Price Calculator — 10K to 24K Value per Gram",
  description:
    "Find what 10K, 14K, 18K, 22K, and 24K gold is worth per gram and per troy ounce at today's live gold price. Enter a weight to value a specific item.",
  alternates: { canonical: tool.href },
  openGraph: {
    title: "Gold Karat Price Calculator",
    description:
      "What is your gold worth? Price per gram and per troy ounce for every karat, at today's spot price.",
    url: tool.href,
    type: "website",
  },
};

/**
 * Copy lives in the UI catalog under `tools.goldKaratPrice.*` so it is pipeline-translated
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
  return withLocaleMetadata(pageMetadata, "/calculator/gold-karat-price", locale);
}

export default async function KaratPricePage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldKaratPrice`);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const purePerGram = exampleSpot / TROY_OZ_TO_GRAMS;
  const price18kPerGram = purePerGram * purityFactorFor("18K");

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
            The gold price you see quoted — currently{" "}
            <strong>{formatUsd(exampleSpot, locale)}</strong> per troy ounce — is the price of{" "}
            <em>pure</em> gold. Every karat below 24 is an alloy, so its value is the spot price
            scaled down by its purity:
          </p>
          <p className="bg-muted/60 border-border rounded-lg border px-4 py-3 font-mono text-sm">
            price per gram = (spot ÷ 31.1035) × (karat ÷ 24)
          </p>
          <p>
            <strong>Worked example.</strong> At {formatUsd(exampleSpot, locale)} per troy ounce, pure gold
            is worth <strong>{formatUsd(purePerGram, locale)}</strong> per gram. 18K gold is 18 parts in 24
            — 75% — so it is worth <strong>{formatUsd(price18kPerGram, locale)}</strong> per gram. A 10 g
            18K chain therefore contains 7.5 g of pure gold and has a melt value of about{" "}
            <strong>{formatUsd(price18kPerGram * 10, locale)}</strong>.
          </p>
          <p>
            That figure is the <em>melt value</em>: what the metal is worth, ignoring craftsmanship,
            brand, and collectability. It is the right number for scrap and bullion, and a floor
            rather than a valuation for jewellery you would sell as jewellery. To see what you would
            pay a dealer for gold — melt value plus their premium — use the{" "}
            <Link href="/calculator" className="text-gold-strong underline underline-offset-4">
              Smart Gold Calculator
            </Link>
            .
          </p>
          <p>
            The spot price is pulled live and refreshes every few minutes; you can overwrite it to
            price a past transaction. See{" "}
            <Link href="/methodology" className="text-gold-strong underline underline-offset-4">
              our methodology
            </Link>{" "}
            for where the price comes from and its limitations.
          </p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <KaratPriceCalculator initialSpot={initialSpot} isStale={priceResult.stale} />
      </Suspense>
    </ToolPageShell>
  );
}
