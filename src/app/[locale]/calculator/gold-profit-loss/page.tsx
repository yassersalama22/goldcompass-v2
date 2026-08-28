import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Num } from "@/components/market/num";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

import { ProfitLossCalculator } from "@/components/calculator/profit-loss-calculator";
import { ToolPageShell, type ToolFaq } from "@/components/calculator/tool-page-shell";
import { ToolSkeleton } from "@/components/calculator/tool-results";
import { getTool } from "@/config/tools";
import { profitLoss } from "@/lib/calculator";
import { formatSignedPct, formatUsd } from "@/lib/format";
import { getGoldQuote } from "@/server/price";

export const revalidate = 300;

const tool = getTool("gold-profit-loss")!;

const FALLBACK_SPOT = 4150;

const pageMetadata: Metadata = {
  title: "Gold Profit & Loss Calculator — Work Out Your Real Return",
  description:
    "Enter your buy price, sell price, and quantity to see profit or loss in dollars and percent after dealer premiums and buy-back spreads — not just the headline price move.",
  alternates: { canonical: tool.href },
  openGraph: {
    title: "Gold Profit & Loss Calculator",
    description:
      "What did your gold actually return? Profit and loss after the costs of buying and selling.",
    url: tool.href,
    type: "website",
  },
};

/**
 * Copy lives in the UI catalog under `tools.goldProfitLoss.*` so it is pipeline-translated
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
  return withLocaleMetadata(pageMetadata, "/calculator/gold-profit-loss", locale);
}

export default async function ProfitLossPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`tools.goldProfitLoss`);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exitSpot = initialSpot ?? FALLBACK_SPOT;
  // Illustrate with a purchase 10% below today's price.
  const entrySpot = exitSpot / 1.1;
  const example = profitLoss({
    entrySpot,
    exitSpot,
    quantity: 1,
    unit: "ozt",
    purityFactor: 1,
    premiumPct: 5,
    sellFeePct: 2,
  })!;

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
            The calculation converts your holding to pure gold content, then applies the costs of
            each side of the trade:
          </p>
          <p className="bg-muted/60 border-border rounded-lg border px-4 py-3 font-mono text-sm">
            cost = pure oz × buy price × (1 + premium)
            <br />
            proceeds = pure oz × sell price × (1 − sell spread)
            <br />
            return = (proceeds − cost) ÷ cost
          </p>
          <p>
            <strong>Worked example.</strong> Suppose you bought one troy ounce of 24K gold at{" "}
            <strong>{formatUsd(entrySpot, locale)}</strong> with a 5% premium — an outlay of{" "}
            <strong>{formatUsd(example.costBasis, locale)}</strong> — and gold is now{" "}
            <strong>{formatUsd(exitSpot, locale)}</strong>, a{" "}
            <strong><Num>{formatSignedPct(example.spotMovePct, 1)}</Num></strong> move. Selling into a 2%
            buy-back spread returns <strong>{formatUsd(example.proceeds, locale)}</strong>, a profit of{" "}
            <strong>{formatUsd(example.pnlUsd, locale)}</strong> — or{" "}
            <strong><Num>{formatSignedPct(example.pnlPct, 1)}</Num></strong>. The metal moved{" "}
            <Num>{formatSignedPct(example.spotMovePct, 1)}</Num>; you kept{" "}
            <Num>{formatSignedPct(example.pnlPct, 1)}</Num>. The difference went to the round trip.
          </p>
          <p>
            That is why gold rewards patience: the transaction cost is paid once, so its drag on
            annual return falls the longer the position is held. The price that erases the drag
            entirely is your{" "}
            <Link
              href="/calculator/gold-break-even"
              className="text-gold-strong underline underline-offset-4"
            >
              break-even
            </Link>{" "}
            — here, {formatUsd(example.breakEvenSpot, locale)}.
          </p>
          <p>
            Figures are pre-tax and exclude storage, insurance, and shipping. For a forward-looking
            view of the price rather than a backward-looking one, see the current{" "}
            <Link href="/outlook" className="text-gold-strong underline underline-offset-4">
              outlook
            </Link>
            .
          </p>
        </>
      }
    >
      <Suspense fallback={<ToolSkeleton />}>
        <ProfitLossCalculator initialSpot={initialSpot} />
      </Suspense>
    </ToolPageShell>
  );
}
