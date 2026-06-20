import type { PriceQuote, PriceSeries } from "@/types/price";

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
}
