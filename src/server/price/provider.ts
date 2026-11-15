import type { PricePoint, PriceQuote, PriceSeries } from "@/types/price";

/**
 * Provider abstraction for the gold price source. The UI/data layer depend on
 * this interface, not on any specific upstream — so CoinGecko can be swapped
 * for a paid metals API later without touching callers.
 */
export interface PriceProvider {
  readonly name: string;
  /** Current spot quote. Throws on upstream failure (caught by the data layer). */
  getQuote(): Promise<PriceQuote>;
  /** Last ~30 days of daily closes. Throws on upstream failure. */
  getSeries30d(): Promise<PriceSeries>;
  /**
   * Up to `days` of daily readings, oldest first — the raw points, including
   * the provider's trailing "right now" point if it sends one. Used by the
   * outlook pipeline (off the request path), never by a page: a year of history
   * is what lets the scorecard see a 200-day average and a 52-week high.
   * Throws on upstream failure.
   */
  getDailyHistory(days: number): Promise<PricePoint[]>;
}
