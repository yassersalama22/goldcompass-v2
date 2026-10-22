import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { richTags } from "@/i18n/rich";

import { Container } from "@/components/layout/container";
import { PriceChart } from "@/components/trends/price-chart";
import { PriceTicker } from "@/components/trends/price-ticker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getGoldQuote, getGoldSeries30d } from "@/server/price";

// ISR: re-render every 5 min; the client ticker also polls for live updates.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trends" });
  return withLocaleMetadata(
    { title: t("metaTitle"), description: t("metaDescription") },
    "/trends",
    locale,
  );
}

export default async function TrendsPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [quote, series] = await Promise.all([
    getGoldQuote(),
    getGoldSeries30d(),
  ]);
  const t = await getTranslations();

  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("trends.heading")}</h1>
        <p className="text-muted-foreground text-lg text-pretty">
          {t("trends.lede")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <PriceTicker initialQuote={quote.data} initialStale={quote.stale} />
        </CardHeader>
        <CardContent className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            {t("trends.last30")}
          </h2>
          {series.data && series.data.points.length >= 2 ? (
            <PriceChart points={series.data.points} />
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t("trends.chartUnavailable")}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-xs">
        {t.rich("trends.footnote", richTags)}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button render={<Link href="/outlook" />}>{t("trends.ctaOutlook")}</Button>
        <Button render={<Link href="/calculator" />} variant="outline">
          {t("nav.calculator")}
        </Button>
      </div>
    </Container>
  );
}
