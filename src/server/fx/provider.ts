import type { FxRates } from "@/types/fx";

/**
 * Exchange-rate source, behind an interface for the same reason as
 * `PriceProvider`: swapping the upstream must not touch a page.
 */
export interface FxProvider {
  readonly name: string;
  /** USD-based rates for the display currencies. Throws on upstream failure. */
  getRates(): Promise<FxRates>;
}
