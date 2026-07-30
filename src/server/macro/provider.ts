import type { MacroSnapshot } from "@/types/macro";

/**
 * Provider abstraction for the macro backdrop, mirroring `PriceProvider`.
 * Callers depend on this, never on FRED — so the source can be swapped (or a
 * silver / gold-silver-ratio provider added alongside) without touching the
 * prompt, the artifact, or the panel.
 */
export interface MacroProvider {
  readonly name: string;
  /** Latest readings. Throws on upstream failure; the data layer catches. */
  getSnapshot(): Promise<MacroSnapshot>;
}
