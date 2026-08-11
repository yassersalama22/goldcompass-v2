"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

import {
  formatLongDate,
  formatShortDate,
  formatSignedPct,
  formatUsd,
  formatUsdCompact,
} from "@/lib/format";

/**
 * Locale-bound formatters for client components.
 *
 * The functions in `lib/format.ts` take a locale and default to English, which
 * is right for server code that already has one in hand. In a client component
 * there is no locale in scope, so calling them bare silently formats an Arabic
 * page in English — and since the currency unit is a *word* in Arabic
 * (`4,283.61 دولار`), that shows up as a `$` on an Arabic page rather than as
 * something subtle like a different thousands separator.
 *
 * This hook removes the chance to forget: interactive components take their
 * formatters from here and never import `formatUsd` directly.
 *
 * `formatSignedPct` is included for convenience even though it takes no locale —
 * so a component needs exactly one import to format anything.
 */
export function useFormat() {
  const locale = useLocale();

  return useMemo(
    () => ({
      usd: (value: number) => formatUsd(value, locale),
      usdCompact: (value: number) => formatUsdCompact(value, locale),
      shortDate: (ms: number) => formatShortDate(ms, locale),
      longDate: (value: Date | string | number) => formatLongDate(value, locale),
      signedPct: formatSignedPct,
    }),
    [locale],
  );
}
