import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

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

const faqs: ToolFaq[] = [
  {
    question: "How much is 18K gold worth per gram?",
    answer:
      "18K gold is 75% pure (750 fine), so a gram of it is worth 75% of a gram of pure gold. Divide the spot price per troy ounce by 31.1035 to get the price per gram of pure gold, then multiply by 0.75. This calculator does that for every karat at the current live gold price.",
  },
  {
    question: "What does the karat number actually mean?",
    answer:
      "Karat measures how many parts out of 24 are gold. 24K is pure gold, 18K is 18 parts gold and 6 parts other metals (75%), 14K is 58.3%, and 10K is 41.7%. The remaining metal is usually copper, silver, or zinc, added for hardness and colour. Karat describes purity, not weight or quality of workmanship.",
  },
  {
    question: "What is the difference between karat and fineness?",
    answer:
      "They express the same thing on different scales. Fineness is parts per thousand, so 18K (75% gold) is stamped 750, 14K is 585 or 583, and 24K is 999 or 999.9. European and modern jewellery is usually stamped with fineness; the karat mark is more common in the United States.",
  },
  {
    question: "Will a dealer pay me the melt value of my gold?",
    answer:
      "No. Melt value is what the metal in an item is worth, and it is the ceiling, not the offer. Scrap buyers typically pay somewhere between 70% and 90% of melt, keeping the difference to cover refining, assay, and margin. Getting quotes from more than one buyer is the practical way to see where you sit in that range.",
  },
  {
    question: "Does the calculator account for gemstones or non-gold parts?",
    answer:
      "It does not. It values the weight you enter as if all of it were gold alloy of the karat you select. For a ring with stones, or a piece with a steel clasp or spring, weigh only the gold portion or expect the true value to be lower than the figure shown.",
  },
];

const mistakes = [
  {
    title: "Weighing in the wrong ounce",
    body: "Gold is priced in troy ounces (31.1035 g), not the kitchen-scale ounce (28.35 g). A troy ounce is about 10% heavier, so using the wrong one understates your gold by roughly a tenth.",
  },
  {
    title: "Treating melt value as the price a dealer will pay",
    body: "Melt value is the metal content only. A scrap buyer pays below it, and a retailer selling you the same gold charges above it. The gap on both sides is the dealer's margin.",
  },
  {
    title: "Trusting an unclear hallmark",
    body: "A worn or missing stamp is not proof of purity, and plated items can carry marks that look convincing. If the value matters, have the piece tested before you rely on any number here.",
  },
  {
    title: "Including stones and findings in the weight",
    body: "Gemstones, clasps, and pins are usually not gold. Weighing the whole item inflates the result, sometimes substantially on stone-set jewellery.",
  },
];

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/calculator/gold-karat-price", locale);
}

export default async function KaratPricePage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const priceResult = await getGoldQuote();
  const initialSpot = priceResult.ok && priceResult.data ? priceResult.data.price : null;

  const exampleSpot = initialSpot ?? FALLBACK_SPOT;
  const purePerGram = exampleSpot / TROY_OZ_TO_GRAMS;
  const price18kPerGram = purePerGram * purityFactorFor("18K");

  return (
    <ToolPageShell
      locale={locale}
      tool={tool}
      intro="Gold is quoted as one price per troy ounce of pure metal, but almost nothing you own is pure. Enter a weight and a karat to see what the gold in it is actually worth."
      faqs={faqs}
      mistakes={mistakes}
      about={
        <>
          <p>
            The gold price you see quoted — currently{" "}
            <strong>{formatUsd(exampleSpot)}</strong> per troy ounce — is the price of{" "}
            <em>pure</em> gold. Every karat below 24 is an alloy, so its value is the spot price
            scaled down by its purity:
          </p>
          <p className="bg-muted/60 border-border rounded-lg border px-4 py-3 font-mono text-sm">
            price per gram = (spot ÷ 31.1035) × (karat ÷ 24)
          </p>
          <p>
            <strong>Worked example.</strong> At {formatUsd(exampleSpot)} per troy ounce, pure gold
            is worth <strong>{formatUsd(purePerGram)}</strong> per gram. 18K gold is 18 parts in 24
            — 75% — so it is worth <strong>{formatUsd(price18kPerGram)}</strong> per gram. A 10 g
            18K chain therefore contains 7.5 g of pure gold and has a melt value of about{" "}
            <strong>{formatUsd(price18kPerGram * 10)}</strong>.
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
