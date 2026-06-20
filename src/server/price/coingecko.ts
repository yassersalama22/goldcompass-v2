import { z } from "zod";

import {
  priceQuoteSchema,
  priceSeriesSchema,
  type PriceQuote,
  type PriceSeries,
} from "@/types/price";
import type { PriceProvider } from "./provider";

const BASE = "https://api.coingecko.com/api/v3";
/** PAX Gold (PAXG): 1 token ≈ 1 troy oz of gold — our free spot proxy. */
const COIN_ID = "pax-gold";
const SOURCE = "CoinGecko (PAX Gold)";

// Cache windows (seconds). One upstream call per window is shared across all
// requests via Next's data cache → respects CoinGecko's free rate limits.
const QUOTE_TTL = 300; // 5 min
const SERIES_TTL = 3600; // 1 h

const simplePriceSchema = z.object({
  [COIN_ID]: z.object({
    usd: z.number(),
    usd_24h_change: z.number().optional(),
    last_updated_at: z.number().optional(),
  }),
});

const marketChartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
});

async function getJson(url: string, revalidate: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

export const coinGeckoProvider: PriceProvider = {
  name: SOURCE,

  async getQuote(): Promise<PriceQuote> {
    const url =
      `${BASE}/simple/price?ids=${COIN_ID}` +
      `&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
    const raw = simplePriceSchema.parse(await getJson(url, QUOTE_TTL));
    const coin = raw[COIN_ID];
    const asOf = coin.last_updated_at
      ? new Date(coin.last_updated_at * 1000).toISOString()
      : new Date().toISOString();

    return priceQuoteSchema.parse({
      price: coin.usd,
      currency: "USD",
      changePct24h: coin.usd_24h_change ?? null,
      asOf,
      source: SOURCE,
    } satisfies PriceQuote);
  },

  async getSeries30d(): Promise<PriceSeries> {
    const url =
      `${BASE}/coins/${COIN_ID}/market_chart` +
      `?vs_currency=usd&days=30&interval=daily`;
    const raw = marketChartSchema.parse(await getJson(url, SERIES_TTL));

    const points = raw.prices.map(([t, price]) => ({
      t: Math.round(t),
      price,
    }));

    return priceSeriesSchema.parse({
      range: "30d",
      currency: "USD",
      points,
    } satisfies PriceSeries);
  },
};
