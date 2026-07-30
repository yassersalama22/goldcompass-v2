import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

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

export const metadata: Metadata = {
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

const faqs: ToolFaq[] = [
  {
    question: "How do I calculate profit on physical gold?",
    answer:
      "Work out the pure gold content of your holding in troy ounces, multiply by your purchase price plus the premium you paid to get your cost, then multiply the same content by the selling price minus any buy-back spread to get your proceeds. Profit is proceeds minus cost. The percentage return is that profit divided by what you originally paid, not by the metal's market value.",
  },
  {
    question: "Why is my return lower than the gold price rise?",
    answer:
      "Because you bought above spot and sold below it. If gold rose 10% but you paid a 5% premium and lost 2% on the buy-back, roughly 7 points of that move went to covering transaction costs, leaving about 3%. The gap between the headline move and your return is the round-trip cost, and it shrinks in importance the longer you hold.",
  },
  {
    question: "Does this calculator include tax?",
    answer:
      "No. Tax treatment of gold varies widely — many jurisdictions treat physical bullion as a collectible or as a capital asset with its own rate, and some exempt certain legal-tender coins entirely. The figures here are pre-tax, and the after-tax outcome depends on your jurisdiction and holding period. Speak to a qualified tax adviser.",
  },
  {
    question: "How should I account for a purchase made in several lots?",
    answer:
      "Use your weighted average purchase price as the buy price and the total quantity as the amount. If the lots carried very different premiums, running them separately and adding the results is more accurate, since the premium is applied to each lot's own cost.",
  },
  {
    question: "Should I use spot price or the price I actually paid?",
    answer:
      "Enter the spot price at the time of each transaction and let the premium and spread inputs handle the costs — that way the calculator can show you the break-even and separate the market move from the friction. If you only remember the total you handed over, set the premium to zero and enter that all-in price per ounce instead.",
  },
];

const mistakes = [
  {
    title: "Measuring return against the metal's value instead of what you paid",
    body: "Dividing profit by the current market value flatters the result. Your return is profit divided by your actual outlay, premium included.",
  },
  {
    title: "Ignoring the premium on the way in",
    body: "Comparing your buy price to today's spot and calling the difference profit skips the cost that made you unprofitable on day one.",
  },
  {
    title: "Using item weight instead of pure gold content",
    body: "A 100 g 14K bracelet contains 58.3 g of gold. Valuing all 100 g at the gold price overstates the position by roughly 70%.",
  },
  {
    title: "Forgetting holding costs on long positions",
    body: "Vault storage and insurance accrue every year you hold. They do not appear here, and over a decade they can consume a meaningful slice of the gain.",
  },
];

export default async function ProfitLossPage() {
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
      tool={tool}
      intro="The gold price rising 10% does not mean you made 10%. Enter what you paid, what you would sell for, and how much you hold to see the return after the costs on both sides."
      faqs={faqs}
      mistakes={mistakes}
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
            <strong>{formatUsd(entrySpot)}</strong> with a 5% premium — an outlay of{" "}
            <strong>{formatUsd(example.costBasis)}</strong> — and gold is now{" "}
            <strong>{formatUsd(exitSpot)}</strong>, a{" "}
            <strong>{formatSignedPct(example.spotMovePct, 1)}</strong> move. Selling into a 2%
            buy-back spread returns <strong>{formatUsd(example.proceeds)}</strong>, a profit of{" "}
            <strong>{formatUsd(example.pnlUsd)}</strong> — or{" "}
            <strong>{formatSignedPct(example.pnlPct, 1)}</strong>. The metal moved{" "}
            {formatSignedPct(example.spotMovePct, 1)}; you kept{" "}
            {formatSignedPct(example.pnlPct, 1)}. The difference went to the round trip.
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
            — here, {formatUsd(example.breakEvenSpot)}.
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
