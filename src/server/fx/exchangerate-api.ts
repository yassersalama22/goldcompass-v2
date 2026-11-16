import { z } from "zod";

import { LOCAL_CURRENCIES, type LocalCurrency } from "@/config/currencies";
import { fxRatesSchema, type FxRates } from "@/types/fx";
import type { FxProvider } from "./provider";

/**
 * ExchangeRate-API "open access" endpoint: free, no key, rates updated once a
 * day.
 *
 * Terms (https://www.exchangerate-api.com/docs/free), checked 2026-11-16:
 * commercial use and caching are allowed; **attribution is required** on pages
 * that show the rates; **redistributing the rates is not**. That is why the
 * rates are never exposed through `/api/v1`, and why every page that converts
 * a price links back to the source (see `source` below).
 *
 * Rate-limited, so the response is cached in Next's data cache and shared by
 * every request: at most one upstream call per window.
 */
const URL_LATEST = "https://open.er-api.com/v6/latest/USD";
const TTL_SECONDS = 6 * 60 * 60; // updates daily; 6h keeps us within a quarter-day of it
const TIMEOUT_MS = 5000;

const SOURCE = { name: "Exchange Rate API", url: "https://www.exchangerate-api.com" };

/**
 * Official pegs. A pegged rate far from its peg means the response is wrong,
 * not that the peg broke overnight — drop that currency rather than show a
 * nonsense price. (EGP floats and KWD is pegged to a basket, so neither is
 * checked.)
 */
const PEGS: Partial<Record<LocalCurrency, number>> = {
  SAR: 3.75,
  AED: 3.6725,
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.3845,
};
const PEG_TOLERANCE = 0.01; // 1%

const responseSchema = z.object({
  result: z.literal("success"),
  base_code: z.literal("USD"),
  time_last_update_unix: z.number(),
  rates: z.record(z.string(), z.number()),
});

export const exchangeRateApiProvider: FxProvider = {
  name: SOURCE.name,

  async getRates(): Promise<FxRates> {
    const res = await fetch(URL_LATEST, {
      headers: { accept: "application/json" },
      next: { revalidate: TTL_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Exchange Rate API ${res.status} ${res.statusText}`);
    const raw = responseSchema.parse(await res.json());

    const rates: Partial<Record<LocalCurrency, number>> = {};
    for (const code of LOCAL_CURRENCIES) {
      const rate = raw.rates[code];
      if (rate == null || !Number.isFinite(rate) || rate <= 0) continue;
      const peg = PEGS[code];
      if (peg != null && Math.abs(rate / peg - 1) > PEG_TOLERANCE) {
        console.error(`[fx] ${code}=${rate} is not near its peg ${peg}; dropping it`);
        continue;
      }
      rates[code] = rate;
    }

    return fxRatesSchema.parse({
      base: "USD",
      rates,
      updatedAt: new Date(raw.time_last_update_unix * 1000).toISOString(),
      source: SOURCE,
    } satisfies FxRates);
  },
};
