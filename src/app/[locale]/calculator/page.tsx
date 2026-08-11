import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { GoldCalculator } from "@/components/calculator/gold-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { TOOLS } from "@/config/tools";
import { getGoldQuote } from "@/server/price";
import { calculatorFaqSchema } from "@/lib/structured-data";

export const revalidate = 300; // ISR: refresh spot price every 5 min

const pageMetadata: Metadata = {
  title: "Smart Gold Calculator — Budget, Quantity & Break-Even",
  description:
    "Calculate how much gold your budget buys at any purity and dealer premium. See break-even prices and profit/loss scenarios at different gold prices.",
  openGraph: {
    title: "Smart Gold Calculator",
    description:
      "How much gold can you buy? Enter your budget, purity, and dealer premium to find out.",
    url: "/calculator",
    type: "website",
  },
};

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/calculator", locale);
}

export default async function CalculatorPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  return (
    <>
      <JsonLd data={calculatorFaqSchema(locale)} />

      <Container className="py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-gold-strong">Smart Gold Calculator</p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            How much gold can you buy?
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Enter your budget, gold purity, and dealer premium to estimate quantity purchased,
            your break-even price, and profit/loss at different spot prices.
          </p>
          <p className="mt-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Educational purposes only — not financial advice. Always consult a qualified advisor
            before investing.
          </p>
        </div>

        {/* Calculator — wrapped in Suspense so useSearchParams in the client component works */}
        <Suspense fallback={<CalculatorSkeleton />}>
          <GoldCalculator initialSpot={initialSpot} isStale={priceResult.stale} />
        </Suspense>

        {/* Tool hub — single-purpose siblings of this combined calculator */}
        <section aria-labelledby="tools-heading" className="mt-12">
          <h2 id="tools-heading" className="text-2xl font-bold">
            More gold tools
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            The calculator above answers the whole question at once. These do one job each, with a
            worked example and the arithmetic explained.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <li key={tool.slug}>
                <Card className="relative h-full transition-shadow hover:shadow-md">
                  <CardContent>
                    <h3 className="font-semibold">
                      <Link
                        href={tool.href}
                        className="hover:text-gold-strong after:absolute after:inset-0 focus-visible:underline"
                      >
                        {tool.name}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {tool.description}
                    </p>
                    <span className="text-gold-strong mt-3 inline-flex items-center gap-1 text-sm font-medium">
                      Open tool
                      <ArrowRight className="rtl:rotate-180 size-3.5" aria-hidden="true" />
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* Methodology note */}
        <div className="mt-10 rounded-xl border border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How this calculator works</p>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            <li>
              <strong>Quantity</strong>: budget ÷ (spot × purity × (1 + premium%)).
              Dealer price per item troy oz = spot × purity factor × (1 + premium).
            </li>
            <li>
              <strong>Break-even</strong>: spot × (1 + premium%). The premium is the minimum
              price rise needed to recover your investment when selling at spot.
            </li>
            <li>
              <strong>P/L scenarios</strong>: assumes you sell pure gold equivalent at the
              given spot price with no sell-side commission. Actual returns depend on market
              conditions, taxes, storage costs, and the dealer&apos;s buy-back spread.
            </li>
            <li>1 troy oz = 31.1035 grams. Spot price source: CoinGecko (PAX Gold proxy).</li>
          </ul>
        </div>
      </Container>
    </>
  );
}

function CalculatorSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[360px_1fr]">
      <div className="h-[480px] rounded-xl bg-muted" />
      <div className="h-[480px] rounded-xl bg-muted" />
    </div>
  );
}
