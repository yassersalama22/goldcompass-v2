import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { plainRichTags } from "@/i18n/rich";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { GoldCalculator } from "@/components/calculator/gold-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { TOOLS, toolCopy } from "@/config/tools";
import { getGoldQuote } from "@/server/price";
import { faqSchema } from "@/lib/structured-data";

export const revalidate = 300; // ISR: refresh spot price every 5 min

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calculatorPage" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: t("metaDescription"),
      openGraph: {
        title: t("ogTitle"),
        description: t("ogDescription"),
        url: "/calculator",
        type: "website",
      },
    },
    "/calculator",
    locale,
  );
}

export default async function CalculatorPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  // ONE array, rendered visibly below AND emitted as FAQPage JSON-LD — Google
  // requires marked-up FAQs to be visible. Until 2026-10-10 this page emitted
  // the JSON-LD with no visible FAQ at all.
  const tf = await getTranslations("calculatorFaq");
  const faqs = ([1, 2, 3, 4] as const).map((n) => ({
    question: tf(`q${n}`),
    answer: tf(`a${n}`),
  }));
  const tp = await getTranslations("page");
  const t = await getTranslations("calculatorPage");

  return (
    <>
      <JsonLd data={faqSchema(faqs, locale)} />

      <Container className="py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-gold-strong">{t("eyebrow")}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{t("heading")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t("lede")}
          </p>
          <p className="mt-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {t("disclaimer")}
          </p>
        </div>

        {/* Calculator — wrapped in Suspense so useSearchParams in the client component works */}
        <Suspense fallback={<CalculatorSkeleton />}>
          <GoldCalculator initialSpot={initialSpot} isStale={priceResult.stale} />
        </Suspense>

        {/* Tool hub — single-purpose siblings of this combined calculator */}
        <section aria-labelledby="tools-heading" className="mt-12">
          <h2 id="tools-heading" className="text-2xl font-bold">
            {t("toolsHeading")}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {t("toolsIntro")}
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
                        {toolCopy(tool, locale).name}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {toolCopy(tool, locale).description}
                    </p>
                    <span className="text-gold-strong mt-3 inline-flex items-center gap-1 text-sm font-medium">
                      {t("openTool")}
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
          <p className="font-medium text-foreground">{t("howHeading")}</p>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            {(["quantity", "breakEven", "scenarios", "units"] as const).map((key) => (
              <li key={key}>{t.rich(`how.${key}`, plainRichTags)}</li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="faq-heading" className="mt-12 space-y-4">
          <h2 id="faq-heading" className="text-2xl font-bold">
            {tp("faqHeading")}
          </h2>
          <dl className="divide-border divide-y border-t border-b">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-4">
                <dt className="font-semibold">{faq.question}</dt>
                <dd className="text-muted-foreground mt-2 leading-7">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
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
