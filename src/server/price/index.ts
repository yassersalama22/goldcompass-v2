import "server-only";
import { cache } from "react";

import type { PriceQuote, PriceResult, PriceSeries } from "@/types/price";
import { coinGeckoProvider } from "./coingecko";
import type { PriceProvider } from "./provider";

/**
 * Gold price data-access layer (headless core).
 *
 * Wraps the configured PriceProvider so callers (website + `/api/v1/price`)
 * NEVER deal with a throw: upstream/network failures return a degraded
 * `PriceResult` ({ ok:false, data:null, stale:true }) instead. This keeps
 * static builds and offline dev working, and lets the UI render explicit
 * error/stale states. Swap the provider here to change the source.
 */
const provider: PriceProvider = coinGeckoProvider;

export const getGoldQuote = cache(async (): Promise<PriceResult<PriceQuote>> => {
  const fetchedAt = new Date().toISOString();
  try {
    const data = await provider.getQuote();
    return { ok: true, data, fetchedAt, stale: false };
  } catch (err) {
    console.error("[price] getGoldQuote failed:", err);
    return { ok: false, data: null, fetchedAt, stale: true };
  }
});

export const getGoldSeries30d = cache(
  async (): Promise<PriceResult<PriceSeries>> => {
    const fetchedAt = new Date().toISOString();
    try {
      const data = await provider.getSeries30d();
      return { ok: true, data, fetchedAt, stale: false };
    } catch (err) {
      console.error("[price] getGoldSeries30d failed:", err);
      return { ok: false, data: null, fetchedAt, stale: true };
    }
  },
);
