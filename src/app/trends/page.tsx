import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { PriceChart } from "@/components/trends/price-chart";
import { PriceTicker } from "@/components/trends/price-ticker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getGoldQuote, getGoldSeries30d } from "@/server/price";

// ISR: re-render every 5 min; the client ticker also polls for live updates.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gold Price Trends",
  description:
    "Live XAU/USD gold spot price and an interactive 30-day price chart, updated throughout the day.",
  alternates: { canonical: "/trends" },
};

export default async function TrendsPage() {
  const [quote, series] = await Promise.all([
    getGoldQuote(),
    getGoldSeries30d(),
  ]);

  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Gold Price Trends</h1>
        <p className="text-muted-foreground text-lg text-pretty">
          The live gold spot price (XAU/USD) and how it has moved over the past
          30 days.
        </p>
      </header>

      <Card>
        <CardHeader>
          <PriceTicker initialQuote={quote.data} initialStale={quote.stale} />
        </CardHeader>
        <CardContent className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            Last 30 days
          </h2>
          {series.data && series.data.points.length >= 2 ? (
            <PriceChart points={series.data.points} />
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              The 30-day chart is temporarily unavailable. Please check back
              shortly.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-xs">
        Price data is provided for educational purposes and may be delayed.
        Source: CoinGecko (PAX Gold proxy). Not financial advice — see our{" "}
        <Link
          href="/disclaimer"
          className="text-gold-strong underline underline-offset-4"
        >
          disclaimer
        </Link>
        .
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button render={<Link href="/outlook" />}>Read the outlook</Button>
        <Button render={<Link href="/calculator" />} variant="outline">
          Gold Calculator
        </Button>
      </div>
    </Container>
  );
}
