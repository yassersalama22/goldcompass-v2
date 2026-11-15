import {
  previewOutcomes,
  priorScores,
  scoreFor,
  type Breach,
  type DailyClose,
  type MarketState,
  type Resolution,
} from "@/server/outlook/signal";
import type { MacroHistory } from "@/types/macro";
import type {
  AdjustmentStep,
  HistoryEntry,
  Horizon,
  Scorecard,
  Signal,
  StandingCall,
} from "@/types/signal";

/**
 * The brief — everything about one horizon that is decided BEFORE the model is
 * asked anything.
 *
 * It holds the scorecard, the standing call being continued, any breach, and
 * the call that each permitted adjustment (−1, 0, +1) would publish. The model
 * is shown all three outcomes and picks a step; the pipeline then publishes the
 * outcome for that step, taken from here. The model's own statement of the
 * signal is only ever compared against it.
 */
export type HorizonBrief = {
  horizon: Horizon;
  scorecard: Scorecard;
  /** The rule-based call being continued, or null on the first run. */
  standing: StandingCall | null;
  /**
   * The last published signal when it predates the rules. Shown to the reader
   * as what the first rule-based call replaced; never used to compute anything.
   */
  legacySignal: Signal | null;
  /** A frozen level broken by a daily close since the last run. */
  breach: Breach | null;
  outcomes: Record<"-1" | "0" | "1", Resolution>;
  /** The non-zero steps that would actually publish a different call. */
  effectiveSteps: (-1 | 1)[];
};

export const STEPS = [-1, 0, 1] as const;
export const stepKey = (step: AdjustmentStep): "-1" | "0" | "1" =>
  String(step) as "-1" | "0" | "1";

export function buildBrief(args: {
  horizon: Horizon;
  state: MarketState;
  /** Oldest first — the same closes the state was built from. */
  closes: DailyClose[];
  macro: MacroHistory | null;
  /** The last published outlook before today, or null if there is none. */
  previousEntry: HistoryEntry | null;
  today: string;
}): HorizonBrief {
  const { horizon, state, closes, macro, previousEntry, today } = args;
  const published = previousEntry?.calls[horizon] ?? null;
  const standing = published?.standing ?? null;
  const legacySignal = standing ? null : (published?.signal ?? null);

  const outcomes = previewOutcomes({
    horizon,
    previous: standing,
    scorecard: scoreFor(horizon, state),
    state,
    newCloses: standing ? closes.filter((c) => c.date > standing.lastChecked) : [],
    priorScores: priorScores(horizon, closes, macro),
    today,
  });

  // The first rule-based call has no rule-based predecessor, but a reader was
  // shown *something* yesterday. Record it, so the page can say what changed.
  if (legacySignal) {
    for (const key of ["-1", "0", "1"] as const) {
      const { call } = outcomes[key];
      if (call.signal !== legacySignal) {
        call.previous = { signal: legacySignal, until: today };
      }
    }
  }

  const neutral = outcomes["0"].call.signal;
  return {
    horizon,
    scorecard: scoreFor(horizon, state),
    standing,
    legacySignal,
    breach: outcomes["0"].breach,
    outcomes,
    effectiveSteps: ([-1, 1] as const).filter(
      (step) => outcomes[stepKey(step)].call.signal !== neutral,
    ),
  };
}
