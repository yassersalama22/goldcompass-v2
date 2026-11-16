import "server-only";
import { cache } from "react";

import type { FxRates } from "@/types/fx";
import { exchangeRateApiProvider } from "./exchangerate-api";
import type { FxProvider } from "./provider";

/**
 * Exchange-rate data-access layer. Like `getGoldQuote()`, it never throws: on
 * failure it returns `null` and pages offer USD only, which is a complete,
 * correct page rather than a broken one.
 *
 * Not exposed via `/api/v1` — see `types/fx.ts` (the source forbids
 * redistributing its rates).
 */
const provider: FxProvider = exchangeRateApiProvider;

export const getFxRates = cache(async (): Promise<FxRates | null> => {
  try {
    return await provider.getRates();
  } catch (err) {
    console.error("[fx] getFxRates failed:", err);
    return null;
  }
});
