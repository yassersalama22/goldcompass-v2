import { z } from "zod";

/**
 * Price contract — shared by the price data-access layer, the website, and the
 * public `/api/v1/price` endpoint (web + future mobile). Mirrors the outlook
 * contract pattern: zod is authoritative, TS types are inferred.
 */
export const PRICE_CONTRACT_VERSION = 1;

export const priceQuoteSchema = z.object({
  /** Spot price in USD per troy ounce. */
  price: z.number().positive(),
  currency: z.literal("USD"),
  /** 24h change in percent, signed (e.g. -0.16). Null if unknown. */
  changePct24h: z.number().nullable(),
  /** ISO timestamp the reading is as-of (from the upstream source). */
  asOf: z.string(),
  /** Human-readable source attribution. */
  source: z.string(),
});
export type PriceQuote = z.infer<typeof priceQuoteSchema>;

export const pricePointSchema = z.object({
  /** Unix epoch milliseconds. */
  t: z.number().int(),
  /** Price in USD at that time. */
  price: z.number().positive(),
});
export type PricePoint = z.infer<typeof pricePointSchema>;

export const priceSeriesSchema = z.object({
  range: z.literal("30d"),
  currency: z.literal("USD"),
  points: z.array(pricePointSchema),
});
export type PriceSeries = z.infer<typeof priceSeriesSchema>;

/**
 * Result wrapper so the data layer never throws to the UI. `ok` distinguishes
 * fresh upstream data from a degraded/empty state; `fetchedAt` is when WE
 * fetched (vs `quote.asOf`, when the source last updated).
 */
export type PriceResult<T> = {
  ok: boolean;
  data: T | null;
  /** ISO timestamp of our fetch attempt. */
  fetchedAt: string;
  /** True when we are serving fallback/last-known rather than fresh data. */
  stale: boolean;
};
