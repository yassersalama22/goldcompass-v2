import { z } from "zod";

/**
 * Signal contract — the vocabulary of how an outlook call is *set*.
 *
 * Kept apart from `types/outlook.ts` so the pure signal logic
 * (`src/server/outlook/signal/`) can depend on these shapes without importing
 * the whole report contract, and so the report contract can compose them.
 *
 * The principle behind every type here (§12): the model does not choose the
 * signal. Code computes a baseline from a published scorecard; the model may
 * shift it by one step for a dated, cited event; a breached level forces a
 * change. These types are the record of that process, stored in the artifact so
 * a reader — or a reviewer — can see why a call says what it says.
 */

export const signalSchema = z.enum(["BUY", "HOLD", "SELL"]);
export type Signal = z.infer<typeof signalSchema>;

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

/** Matches `calls[].term`. */
export const horizonSchema = z.enum(["short", "long"]);
export type Horizon = z.infer<typeof horizonSchema>;

/**
 * Scorecard factors. Keys, not labels: the UI catalog owns the wording, so the
 * artifact carries nothing here that needs translating.
 */
export const factorKeySchema = z.enum([
  // Short-term (1–4 weeks)
  "momentum20d",
  "trend50d",
  "stretch50d",
  "realYield30d",
  "dollar30d",
  // Long-term (3–12 months)
  "trend200d",
  "maCross",
  "return90d",
  "drawdown52w",
  "realYield90d",
  "dollar90d",
]);
export type FactorKey = z.infer<typeof factorKeySchema>;

export const factorSchema = z.object({
  key: factorKeySchema,
  /**
   * Pressure on gold from this factor: −2 (strong headwind) … +2 (strong
   * support). Zero means neutral *or* not measurable — `value: null` tells the
   * two apart.
   */
  reading: z.number().int().min(-2).max(2),
  /** The measurement the reading was derived from. Null when unavailable. */
  value: z.number().nullable(),
  /** "percent" = relative move; "pp" = percentage points (yields). */
  unit: z.enum(["percent", "pp"]),
});
export type Factor = z.infer<typeof factorSchema>;

export const scorecardSchema = z.object({
  /** Sum of the factor readings. */
  score: z.number().int(),
  factors: z.array(factorSchema),
});
export type Scorecard = z.infer<typeof scorecardSchema>;

/**
 * The price levels that would prove a standing call wrong.
 *
 * Derived by code when the call opens and then FROZEN until the call changes.
 * That is the whole point: a level that is rewritten every day just below the
 * current price can never be hit, and a view that cannot be wrong cannot be
 * assessed.
 */
export const levelsSchema = z.object({
  /** A daily close below this breaks the call downward. */
  below: z.number().positive().optional(),
  /** A daily close above this breaks the call upward. */
  above: z.number().positive().optional(),
  /** ISO date the levels were set (= the date the call opened). */
  setOn: z.string(),
  basis: z.literal("daily-close"),
});
export type Levels = z.infer<typeof levelsSchema>;

export const changeReasonSchema = z.enum([
  /** A frozen level was breached — the call was required to move. */
  "invalidation_hit",
  /** The scorecard baseline moved to a different signal. */
  "evidence_shift",
  /** A dated, cited event moved the call one step off the baseline. */
  "event_adjustment",
  /** A previous event adjustment no longer applies. */
  "adjustment_ended",
  /** First call under a new rule set — not a market event. */
  "methodology_change",
]);
export type ChangeReason = z.infer<typeof changeReasonSchema>;

export const adjustmentStepSchema = z.union([
  z.literal(-1),
  z.literal(0),
  z.literal(1),
]);
export type AdjustmentStep = z.infer<typeof adjustmentStepSchema>;

/* -------------------------------------------------------------------------- */
/* Standing calls + history                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The full state of one standing call — everything the next run needs in order
 * to continue it. Stored in `history.json`, NOT in the public artifact: fields
 * like `pinned` and `lastChecked` are pipeline bookkeeping, and §4 says the
 * public contract never leaks internals. The artifact carries the reader-facing
 * subset (`since`, `levels`, `previous`, `change`, `baseline`).
 */
export const standingCallSchema = z.object({
  horizon: horizonSchema,
  signal: signalSchema,
  confidence: confidenceSchema,
  /** ISO date this signal has stood since. */
  since: z.string(),
  levels: levelsSchema,
  /** What the scorecard alone says (after hysteresis and confirmation). */
  baseline: signalSchema,
  score: z.number().int(),
  /** The adjustment actually in effect — zero when ignored or without effect. */
  adjustmentStep: adjustmentStepSchema,
  /**
   * True when a breach forced the call past what the scorecard supports. A
   * pinned call holds until the baseline itself moves or its new levels are
   * breached, so it cannot bounce straight back the next morning.
   */
  pinned: z.boolean(),
  /** Date of the last daily close checked against the levels. */
  lastChecked: z.string(),
  /** The call this one replaced. Carried for as long as this call stands. */
  previous: z.object({ signal: signalSchema, until: z.string() }).optional(),
  /** Why this call opened. Carried for as long as this call stands. */
  change: z.object({ reason: changeReasonSchema, date: z.string() }).optional(),
});
export type StandingCall = z.infer<typeof standingCallSchema>;

/**
 * A dated event the analysis leans on. This is where current affairs enter the
 * call in a way that can be checked: an adjustment must cite one of these, and
 * the one it cites must be recent, sourced, and point the same way.
 */
export const driverSchema = z.object({
  title: z.string().min(1).max(140),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  /** Which call the event bears on. */
  horizon: z.enum(["short", "long", "both"]),
  /** ISO date the event happened or was reported — not the date we read it. */
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** One or two sentences: what happened and why it matters for gold. */
  summary: z.string().min(1).max(500),
  url: z.string().url(),
});
export type Driver = z.infer<typeof driverSchema>;

/**
 * One published outlook, as the next run needs to remember it.
 *
 * Entries before the rules existed carry only what was published (`standing`
 * absent, `legacy: true`). They are kept so the first rule-based call can say
 * what it replaced, and so a track record can later be scored honestly —
 * including the period the model chose freely.
 */
const historyCallSchema = z.object({
  signal: signalSchema,
  confidence: confidenceSchema,
  standing: standingCallSchema.optional(),
});

export const historyEntrySchema = z.object({
  /** ISO date of the outlook. One entry per date. */
  date: z.string(),
  spot: z.number().positive(),
  /** True for calls chosen by the model, before the scorecard. */
  legacy: z.boolean().optional(),
  rulesVersion: z.string().optional(),
  promptVersion: z.string().optional(),
  calls: z.object({ short: historyCallSchema, long: historyCallSchema }),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const historySchema = z.array(historyEntrySchema);
