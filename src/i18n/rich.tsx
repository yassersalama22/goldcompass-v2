import type { ReactNode } from "react";

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
};
