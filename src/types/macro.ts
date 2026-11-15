import { z } from "zod";

/**
 * Macro contract — the deterministic macro backdrop we feed to the outlook
 * generator as ground truth, and render as the "macro pressure" panel.
 *
 * Same rule as the price contract (§4): the model never supplies these numbers.
 * They are fetched, snapshotted into the published artifact, and displayed —
 * so the panel a reader sees is provably the data the analysis reasoned over.
 */
export const MACRO_CONTRACT_VERSION = 1;

export const macroIndicatorKeySchema = z.enum([
  /** Trade-weighted broad US dollar index (Fed). NOT the ICE "DXY". */
  "dollarIndex",
  /** 10-year TIPS yield — the real rate that drives gold's opportunity cost. */
  "real10y",
  /** 10-year nominal Treasury yield. */
  "nominal10y",
  /** Nominal minus real: the market's 10-year inflation expectation. */
  "breakeven10y",
]);
export type MacroIndicatorKey = z.infer<typeof macroIndicatorKeySchema>;

export const macroIndicatorSchema = z.object({
  key: macroIndicatorKeySchema,
  /** Display label, e.g. "10-year real yield". */
  label: z.string().min(1),
  /** Latest reading. */
  value: z.number(),
  /** "percent" renders as 1.94%, "index" as 121.3. */
  unit: z.enum(["percent", "index"]),
  /**
   * Absolute change over ~30 days, in the same unit (percentage *points* for
   * yields). Null when we lack a comparable earlier observation.
   */
  change30d: z.number().nullable(),
  /**
   * Same, over ~90 days — the window the long-term scorecard reads. Optional:
   * it post-dates the first published snapshots, which stay valid without it.
   */
  change90d: z.number().nullable().optional(),
  /**
   * Where the latest reading sits within its own trailing year, 0–100. A real
   * yield at the 95th percentile is a different backdrop from one at the 20th
   * even if both rose 0.1pp this month.
   */
  pctile1y: z.number().min(0).max(100).nullable().optional(),
  /** ISO date of the latest observation (these series are daily, not intraday). */
  asOf: z.string(),
  /**
   * Whether a rise in this indicator is typically a headwind or a tailwind for
   * gold. Editorial, fixed per indicator, and shown so the panel is readable by
   * someone who does not already know the relationships.
   */
  goldEffect: z.enum(["headwind", "tailwind"]),
});
export type MacroIndicator = z.infer<typeof macroIndicatorSchema>;

export const macroSnapshotSchema = z.object({
  indicators: z.array(macroIndicatorSchema),
  /** Attribution string, rendered under the panel. Required by the source's terms. */
  source: z.string().min(1),
  /** ISO timestamp of our fetch. */
  fetchedAt: z.string(),
});
export type MacroSnapshot = z.infer<typeof macroSnapshotSchema>;

/** One dated reading of a daily series. */
export type MacroObservation = { date: string; value: number };

/**
 * The raw daily series behind the snapshot, oldest first.
 *
 * The snapshot answers "what is the backdrop today"; the history lets the
 * signal logic answer the same question *as of any past date*, which is what
 * makes the scorecard replayable rather than something we can only assert.
 */
export type MacroHistory = {
  dollarIndex: MacroObservation[];
  real10y: MacroObservation[];
  nominal10y: MacroObservation[];
};

/** Mirrors `PriceResult` — the data layer degrades instead of throwing. */
export type MacroResult = {
  ok: boolean;
  data: MacroSnapshot | null;
  fetchedAt: string;
  stale: boolean;
};
