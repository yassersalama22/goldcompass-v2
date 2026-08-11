import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

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

const pageMetadata: Metadata = {
  title: "Gold Break-Even Calculator — How Far Must Gold Rise?",
  description:
    "Work out the gold price you need to get your money back after dealer premiums and buy-back spreads. See how break-even changes across bars, coins, and jewellery.",
  alternates: { canonical: tool.href },
  openGraph: {
    title: "Gold Break-Even Calculator",
    description:
      "Premiums mean you start underwater. Find the gold price that returns your money.",
    url: tool.href,
    type: "website",
  },
};

const faqs: ToolFaq[] = [
  {
    question: "How do you calculate the break-even price for gold?",
    answer:
      "Break-even is the purchase spot price multiplied by one plus the dealer premium, divided by one minus the sell-side spread. Buying at $4,000 with a 5% premium and no selling cost means gold must reach $4,200 before you are level. Add a 2% buy-back spread and break-even rises to about $4,286.",
  },
  {
    question: "Why am I losing money the moment I buy gold?",
    answer:
      "Because you paid above spot and would sell at or below it. The dealer premium covers minting, distribution, and margin, and it is not part of the metal's market value. Until the spot price climbs past your premium, selling would return less than you paid — this is normal for physical gold and is the reason it suits long holding periods.",
  },
  {
    question: "Does buying a higher karat lower my break-even?",
    answer:
      "No. Purity scales what you paid and what you would receive by exactly the same factor, so it cancels out of the calculation. A 10K buyer and a 24K buyer paying the same percentage premium both need the same percentage rise in the gold price. What lowers break-even is a smaller premium, which usually means larger bars rather than higher karats.",
  },
  {
    question: "What is a typical dealer premium on gold?",
    answer:
      "Premiums fall roughly as product size rises. Kilogram bars often trade near 1–3% over spot, one-ounce bars around 3–5%, popular bullion coins around 4–8%, and jewellery commonly 10–15% or more because it prices in craftsmanship. Collectible and limited-mintage coins can carry far higher premiums that have little to do with metal content.",
  },
  {
    question: "Should I include storage and insurance in break-even?",
    answer:
      "If you pay for them, yes — but they behave differently from premiums. A premium is a one-off cost fixed at purchase, whereas storage and insurance accrue each year, so your break-even price rises the longer you hold. This calculator covers the transaction costs; add roughly 0.5–1% per year of holding costs if you use a paid vault.",
  },
];

const mistakes = [
  {
    title: "Forgetting the sell side",
    body: "Most people budget for the premium they pay and ignore the spread they lose on the way out. Both sit between you and break-even, and a buy-back discount can be as large as the original premium.",
  },
  {
    title: "Chasing high-premium products for the wrong reason",
    body: "Fractional coins and small bars carry the steepest premiums per ounce. They are convenient and easy to sell in pieces, but the gold price has to travel considerably further before you are even.",
  },
  {
    title: "Thinking a higher karat gets you there faster",
    body: "Purity cancels out of break-even entirely. The percentage move required is set by your costs, not by the alloy you chose.",
  },
  {
    title: "Comparing break-even against a headline price you cannot get",
    body: "The quoted spot price is a wholesale benchmark. What a retail buy-back actually pays is a little below it, which is what the sell-side spread input is for.",
  },
];

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/calculator/gold-break-even", locale);
}

export default async function BreakEvenPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const example = breakEven({ spotUsd: exampleSpot, premiumPct: 5, sellFeePct: 2 })!;
  const spotOnly = breakEven({ spotUsd: exampleSpot, premiumPct: 5, sellFeePct: 0 })!;

  return (
    <ToolPageShell
      locale={locale}
      tool={tool}
      intro="Buying physical gold starts you below water: you pay above spot and sell at or below it. This works out exactly how far the gold price has to move before you have your money back."
      faqs={faqs}
      mistakes={mistakes}
      about={
        <>
          <p>Break-even has two costs in it, one on each side of the trade:</p>
          <p className="bg-muted/60 border-border rounded-lg border px-4 py-3 font-mono text-sm">
            break-even = spot × (1 + premium) ÷ (1 − sell spread)
          </p>
          <p>
            <strong>Worked example.</strong> Buying at today&apos;s spot of{" "}
            <strong>{formatUsd(exampleSpot, locale)}</strong> with a 5% dealer premium means you effectively
            pay <strong>{formatUsd(example.costPerPureTroyOz, locale)}</strong> per troy ounce of pure gold.
            If you could sell at spot with no cost, gold would need to reach{" "}
            <strong>{formatUsd(spotOnly.breakEvenSpot, locale)}</strong>. Allow a 2% buy-back spread and the
            target rises to <strong>{formatUsd(example.breakEvenSpot, locale)}</strong> — a{" "}
            <strong>+{example.requiredRisePct.toFixed(1)}%</strong> move before you make a cent.
          </p>
          <p>
            Notice what is <em>not</em> in that formula: purity. Karat scales your cost and your
            proceeds identically, so it cancels out. Two buyers paying the same premium need the
            same percentage move whether they bought 10K or 24K. The lever that genuinely moves
            break-even is the premium, which is mostly a function of product size.
          </p>
          <p>
            To see whether a given move is plausible from here, read the current{" "}
            <Link href="/outlook" className="text-gold-strong underline underline-offset-4">
              gold market outlook
            </Link>{" "}
            and the{" "}
            <Link href="/trends" className="text-gold-strong underline underline-offset-4">
              30-day price trend
            </Link>
            . To turn a break-even into an actual profit figure, use the{" "}
            <Link
              href="/calculator/gold-profit-loss"
              className="text-gold-strong underline underline-offset-4"
            >
              profit and loss calculator
            </Link>
            .
          </p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <BreakEvenCalculator initialSpot={initialSpot} isStale={priceResult.stale} />
      </Suspense>
    </ToolPageShell>
  );
}
