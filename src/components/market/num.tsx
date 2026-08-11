import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Bidi-isolated numeric run.
 *
 * Wrap every price, percentage, key level and quantity that can appear inside
 * prose. This is not cosmetic — it is a correctness fix for RTL.
 *
 * The Unicode bidirectional algorithm classifies `+`, `-`, `$` and `%` as
 * *neutral* characters, whose direction is inferred from their surroundings.
 * Inside Arabic text that surrounding context is RTL, so a run like `-0.85%`
 * gets reordered: the minus sign detaches from the digits and renders on the
 * wrong side, turning a fall into something that reads as a rise. `$4,160.50`
 * loses its currency mark to the far side of the number. Neither is a styling
 * nuisance; on a page whose entire purpose is telling someone whether gold went
 * up or down, it is a factual error rendered by the browser.
 *
 * `<bdi>` plus an explicit `dir="ltr"` opens an isolate: the run is laid out
 * left-to-right internally and treated as a single opaque unit by the
 * surrounding RTL paragraph, so it lands in the right place *and* reads
 * correctly. `<bdi>` is the semantically correct element (it exists for exactly
 * this) and needs no CSS, so it works before stylesheets load.
 *
 * Latin digits are guaranteed upstream by the registry's `ar-u-nu-latn` tag —
 * see `src/config/locales.ts`. This component handles ordering; that handles
 * which glyphs get used.
 */
export function Num({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={cn("inline-block", className)}>
      {children}
    </bdi>
  );
}
