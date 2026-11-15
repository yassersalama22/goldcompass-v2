import type { ReactNode } from "react";

import { MoneyText, Num } from "@/components/market/num";
import { Link } from "@/i18n/navigation";

/**
 * Render functions for the inline tags used in rich-text catalog messages,
 * passed to `t.rich()`.
 *
 * A paragraph with a link or emphasis in it stays ONE message with the markup
 * inside it — e.g. `"… on our <trends>trends page</trends> …"` — rather than
 * being split at the tag. Splitting hands the translator sentence fragments it
 * cannot reorder, which is how a translation ends up grammatical in pieces and
 * wrong as a whole. `i18n:check` enforces that every tag survives translation.
 *
 * Link tags are named after their destination so the catalog never carries a
 * URL; adding one here makes it available to every message.
 */
const LINK_CLASS = "text-gold-strong underline underline-offset-4";

export const linkTag = (href: string, className = LINK_CLASS) =>
  function LinkTag(chunks: ReactNode) {
    return (
      <Link href={href} className={className}>
        {chunks}
      </Link>
    );
  };

export const richTags = {
  strong: (chunks: ReactNode) => <strong className="text-foreground">{chunks}</strong>,
  em: (chunks: ReactNode) => <em>{chunks}</em>,
  trends: linkTag("/trends"),
  outlook: linkTag("/outlook"),
  insights: linkTag("/insights"),
  calculator: linkTag("/calculator"),
  methodology: linkTag("/methodology"),
  aiDisclosure: linkTag("/ai-disclosure"),
  disclaimer: linkTag("/disclaimer"),
  breakEven: linkTag("/calculator/gold-break-even"),
  karatPrice: linkTag("/calculator/gold-karat-price"),
  profitLoss: linkTag("/calculator/gold-profit-loss"),
  unitConverter: linkTag("/calculator/gold-unit-converter"),
};

/** Rich-text chunks arrive as a node or an array of strings; join them back. */
function chunkText(chunks: ReactNode): string {
  return Array.isArray(chunks) ? chunks.join("") : String(chunks ?? "");
}

/**
 * Tags for values embedded in a sentence: `<num>{pct}</num>` and
 * `<money>{level}</money>`, the arguments pre-formatted by the caller.
 *
 * A value inside a translated sentence needs the same bidi treatment as one on
 * its own (`<Num>`, `<MoneyText>`): in Arabic, `30.4%` and `4,121 دولار` must
 * each be isolated, with a suffix unit kept outside the isolate. Doing it in a
 * tag keeps the whole sentence one message a translator can reorder.
 */
export const valueTags = {
  num: (chunks: ReactNode) => <Num>{chunkText(chunks)}</Num>,
  money: (chunks: ReactNode) => <MoneyText text={chunkText(chunks)} />,
};

/**
 * For prose whose `<strong>` inherits the surrounding colour (calculator
 * explainers, notes) rather than lifting to the foreground colour.
 */
export const plainRichTags = {
  ...richTags,
  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
};
