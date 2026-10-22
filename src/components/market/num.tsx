import type { ReactNode } from "react";
import { useLocale } from "next-intl";

import { formatUsdParts } from "@/lib/format";

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

/**
 * A money amount whose sign must stay attached — P/L figures, signed deltas.
 *
 * `<Num>` alone is not enough once the currency unit is a word: wrapping
 * `+4,000.00 دولار` in one LTR isolate keeps the sign but puts `دولار` on the
 * wrong side for an Arabic reader. So only the signed amount is isolated and a
 * suffix unit follows it in the paragraph's own direction. For a prefix unit
 * (`$`) the whole thing stays one isolate, so English renders exactly as
 * `+$4,000.00` / `$-103.38`, as it always has.
 */
export function SignedUsd({ value, showPlus = true }: { value: number; showPlus?: boolean }) {
  const { amount, unit, position } = formatUsdParts(value, useLocale());
  const plus = showPlus && value >= 0 ? "+" : "";
  if (position === "prefix") return <Num>{`${plus}${unit}${amount}`}</Num>;
  return (
    <>
      <Num>{`${plus}${amount}`}</Num> {unit}
    </>
  );
}
