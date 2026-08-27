import { Container } from "@/components/layout/container";
import { Prose } from "@/components/markdown/prose";
import { formatLongDate } from "@/lib/format";
import type { PageDoc } from "@/types/page";

/**
 * Layout for a static prose page rendered from a content artifact.
 *
 * Only pages that are genuinely prose documents use this. `/methodology` and
 * `/ai-disclosure` deliberately keep their hand-built JSX: they carry
 * definition-list cards, a styled step sequence, section icons and heading
 * anchors that other pages link to, none of which survive a round trip through
 * Markdown without either losing the design or growing a renderer that every
 * future page would inherit.
 */
export function ProsePage({
  page,
  locale,
  updatedLabel,
}: {
  page: PageDoc;
  locale: string;
  /** Localized "Last updated" label; the date itself is formatted per locale. */
  updatedLabel: string;
}) {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <header className="space-y-2">
        <p className="text-gold-strong text-sm font-medium">{page.eyebrow}</p>
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">{page.heading}</h1>
        <p className="text-muted-foreground text-sm">
          {updatedLabel} {formatLongDate(page.updatedAt, locale)}
        </p>
      </header>

      <p className="text-muted-foreground mt-6 text-lg text-pretty">{page.lede}</p>

      <div className="text-muted-foreground mt-8 text-sm leading-relaxed sm:text-base">
        <Prose markdown={page.bodyMarkdown} />
      </div>
    </Container>
  );
}
