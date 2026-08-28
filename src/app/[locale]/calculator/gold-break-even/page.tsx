import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
  return withLocaleMetadata(pageMetadata, "/calculator/gold-break-even", locale);
}

export default async function BreakEvenPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldBreakEven`);

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
