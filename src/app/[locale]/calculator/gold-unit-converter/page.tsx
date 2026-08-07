import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

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

const faqs: ToolFaq[] = [
  {
    question: "How many grams are in a troy ounce of gold?",
    answer:
      "One troy ounce is 31.1035 grams. This is the unit gold is priced in worldwide, and it is heavier than the everyday avoirdupois ounce used for food and post, which is 28.3495 grams.",
  },
  {
    question: "Why is gold weighed in troy ounces instead of normal ounces?",
    answer:
      "The troy system is a medieval standard for precious metals that survived the switch to avoirdupois for general goods. Because bullion markets, refiners, and futures contracts all standardised on it, gold quotes stayed in troy ounces. The practical consequence is that a troy ounce of gold is about 10% heavier than an ounce of anything else.",
  },
  {
    question: "What is a tola and where is it used?",
    answer:
      "A tola is 11.6638 grams, a traditional South Asian unit still in everyday use for gold in India, Pakistan, Bangladesh, and the Gulf. Bars are commonly cast in 10-tola sizes, which is why a 116.64 g bar is a standard product rather than an odd one.",
  },
  {
    question: "What is a pennyweight?",
    answer:
      "A pennyweight (dwt) is 1.55517 grams, or one twentieth of a troy ounce. North American scrap-gold buyers and some jewellers quote in pennyweight, so an offer 'per dwt' is per 1.56 g — a smaller unit than a gram buyer might assume.",
  },
  {
    question: "Does purity change the weight conversion?",
    answer:
      "No. Ten grams is ten grams whether the item is 10K or 24K, so the weight columns do not move when you change purity. What purity changes is value: a gram of 14K gold contains 0.583 g of pure gold, so it is worth 58.3% of what a gram of pure gold is worth.",
  },
];

const mistakes = [
  {
    title: "Confusing troy ounces with ordinary ounces",
    body: "The two differ by about 10%. Selling 10 'ounces' priced as avoirdupois when you actually hold troy ounces gives away roughly a full ounce of gold.",
  },
  {
    title: "Comparing a per-gram quote to a per-pennyweight quote",
    body: "A dealer quoting per dwt is quoting per 1.555 g. A price that looks higher per unit can be the lower offer once both are converted to the same basis.",
  },
  {
    title: "Assuming a kilo bar is 32 troy ounces",
    body: "A 1 kg bar is 32.15 troy ounces. Rounding it to 32 quietly loses about half an ounce of gold, which is not a rounding error at bullion prices.",
  },
  {
    title: "Reading a converted value as an offer price",
    body: "The values here are pure metal content at spot. What you actually pay or receive includes a dealer premium or spread on top.",
  },
];

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/calculator/gold-unit-converter", locale);
}

export default async function UnitConverterPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const perGram = exampleSpot / TROY_OZ_TO_GRAMS;

  return (
    <ToolPageShell
      locale={locale}
      tool={tool}
      intro="Gold trades in troy ounces, is sold by the gram, and is bought by the tola or pennyweight depending where you are. Convert between all of them — and see what each is worth right now."
      faqs={faqs}
      mistakes={mistakes}
      about={
        <>
          <p>
            Every conversion here routes through grams as the base unit, so nothing is converted
            twice and no rounding compounds:
          </p>
          <ul className="marker:text-gold-strong list-disc space-y-1 pl-6">
            <li>1 troy ounce (ozt) = 31.1035 g</li>
            <li>1 ounce, avoirdupois (oz) = 28.349523125 g</li>
            <li>1 pennyweight (dwt) = 1.55517384 g = 1/20 troy oz</li>
            <li>1 tola = 11.6638038 g</li>
            <li>1 kilogram = 1,000 g = 32.1507 troy oz</li>
          </ul>
          <p>
            <strong>Worked example.</strong> At a spot price of{" "}
            <strong>{formatUsd(exampleSpot)}</strong> per troy ounce, pure gold is worth{" "}
            <strong>{formatUsd(perGram)}</strong> per gram. A 1 kg bar therefore holds 32.15 troy
            ounces and is worth about <strong>{formatUsd(perGram * 1000)}</strong>, while a single
            pennyweight of pure gold is worth <strong>{formatUsd(perGram * 1.55517384)}</strong>.
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
