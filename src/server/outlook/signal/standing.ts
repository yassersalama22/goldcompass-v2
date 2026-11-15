import type {
  AdjustmentStep,
  ChangeReason,
  Horizon,
  Levels,
  Scorecard,
  Signal,
  StandingCall,
} from "@/types/signal";

import type { DailyClose, MarketState } from "./market-state";
import { RULES, baselineFrom, confidenceFor } from "./scorecard";

/**
 * Standing calls — the part that makes a call falsifiable.
 *
 * The first pipeline was stateless: every run wrote a fresh call and a fresh
 * "this would change our view" level just under the current price. As price
 * fell the level fell with it ($4,150 → $4,000 → $3,800), so it was never hit
 * and the call never had to change. A level that follows the price is not a
 * level.
 *
 * Here a call is a standing position. It opens on a date with levels derived
 * from the data that day; the levels are then frozen. Each run checks every
 * daily close since the last one against them, and a breach *forces* the call
 * to move — the model is not asked, and cannot argue it away.
 *
 * Pure: no I/O, no clock.
 */

export type Breach = { side: "below" | "above"; date: string; close: number; level: number };

const ORD: Record<Signal, number> = { SELL: -1, HOLD: 0, BUY: 1 };
const FROM_ORD: Signal[] = ["SELL", "HOLD", "BUY"];
const toSignal = (ord: number): Signal => FROM_ORD[Math.max(-1, Math.min(1, ord)) + 1]!;

/**
 * Levels for a call opening now. BUY can only be broken downward, SELL only
 * upward, and HOLD — a claim that price stays in a range — either way.
 */
export function deriveLevels(
  signal: Signal,
  horizon: Horizon,
  state: MarketState,
  today: string,
): Levels {
  const { minDistancePct } = RULES.levels[horizon];
  const low = horizon === "short" ? state.low20d : state.low90d;
  const high = horizon === "short" ? state.high20d : state.high90d;

  // Never closer than the minimum distance: a level a routine day's move can
  // reach would turn ordinary noise into a forced change.
  const floor = state.price * (1 - minDistancePct / 100);
  const ceiling = state.price * (1 + minDistancePct / 100);
  const below = Math.floor(low == null ? floor : Math.min(low, floor));
  const above = Math.ceil(high == null ? ceiling : Math.max(high, ceiling));

  return {
    ...(signal !== "SELL" ? { below } : {}),
    ...(signal !== "BUY" ? { above } : {}),
    setOn: today,
    basis: "daily-close",
  };
}

/** The first daily close, in order, that broke a level — or null. */
export function findBreach(levels: Levels, closes: DailyClose[]): Breach | null {
  for (const { date, close } of closes) {
    if (levels.below !== undefined && close < levels.below) {
      return { side: "below", date, close, level: levels.below };
    }
    if (levels.above !== undefined && close > levels.above) {
      return { side: "above", date, close, level: levels.above };
    }
  }
  return null;
}

export type ResolveInput = {
  horizon: Horizon;
  /** The standing call, or null for the first call under these rules. */
  previous: StandingCall | null;
  scorecard: Scorecard;
  state: MarketState;
  /** Daily closes after `previous.lastChecked`, oldest first. */
  newCloses: DailyClose[];
  /**
   * Scores of the readings before today's, most recent first — what a baseline
   * move is confirmed against. See `priorScores()` in `scorecard.ts`.
   */
  priorScores?: number[];
  /** Override `RULES.confirmDays`. For the replay's comparisons only. */
  confirmDays?: number;
  /** The adjustment requested for this run. Zero when none. */
  step: AdjustmentStep;
  /** ISO date of this run — becomes `since` if the call changes. */
  today: string;
};

export type Resolution = {
  call: StandingCall;
  breach: Breach | null;
  /** True when the signal differs from the previous standing call's. */
  changed: boolean;
};

/**
 * Decide today's call. The order of precedence is the design:
 *
 *  1. A breached level forces at least one step toward the breached side.
 *     An adjustment cannot undo it.
 *  2. A pinned call holds while the baseline is unchanged — adjustments are
 *     ignored, so "the data forced this" cannot be talked back in a day.
 *  3. Otherwise the call is the baseline shifted by at most one step.
 */
export function resolveCall(input: ResolveInput): Resolution {
  const { horizon, previous, scorecard, state, step, today } = input;
  const baseline = baselineFrom(
    scorecard.score,
    previous?.baseline ?? null,
    horizon,
    input.priorScores,
    input.confirmDays,
  );
  const candidate = toSignal(ORD[baseline] + step);
  const breach = previous ? findBreach(previous.levels, input.newCloses) : null;

  let signal: Signal;
  let pinned = false;
  let reason: ChangeReason | null = null;

  if (!previous) {
    signal = candidate;
    reason = "methodology_change";
  } else if (breach) {
    const bound = toSignal(ORD[previous.signal] + (breach.side === "below" ? -1 : 1));
    signal =
      breach.side === "below"
        ? toSignal(Math.min(ORD[candidate], ORD[bound]))
        : toSignal(Math.max(ORD[candidate], ORD[bound]));
    pinned = signal !== candidate;
    reason = "invalidation_hit";
  } else if (previous.pinned && baseline === previous.baseline) {
    signal = previous.signal;
    pinned = true;
  } else {
    signal = candidate;
    if (signal !== previous.signal) {
      if (baseline !== previous.baseline) reason = "evidence_shift";
      else if (ORD[signal] !== ORD[baseline]) reason = "event_adjustment";
      else reason = "adjustment_ended";
    }
  }

  // What the adjustment actually did: nothing while pinned, and nothing when
  // the baseline was already at the end of the scale.
  const adjustmentStep = (pinned ? 0 : ORD[signal] - ORD[baseline]) as AdjustmentStep;
  const changed = previous !== null && signal !== previous.signal;
  const opened = previous === null || changed;

  const call: StandingCall = {
    horizon,
    signal,
    confidence: confidenceFor(signal, scorecard, horizon, {
      adjusted: adjustmentStep !== 0,
      pinned,
    }),
    since: opened ? today : previous.since,
    levels: opened ? deriveLevels(signal, horizon, state, today) : previous.levels,
    baseline,
    score: scorecard.score,
    adjustmentStep,
    pinned,
    lastChecked: state.asOf,
    ...(changed
      ? { previous: { signal: previous.signal, until: today } }
      : previous?.previous
        ? { previous: previous.previous }
        : {}),
    ...(opened && reason
      ? { change: { reason, date: today } }
      : previous?.change
        ? { change: previous.change }
        : {}),
  };

  return { call, breach, changed };
}

/**
 * What each possible adjustment would produce. Handed to the model so its prose
 * can be written for the call that will actually be published, and so the
 * pipeline can verify the signal it declares against the one the rules give.
 */
export function previewOutcomes(
  input: Omit<ResolveInput, "step">,
): Record<"-1" | "0" | "1", Resolution> {
  return {
    "-1": resolveCall({ ...input, step: -1 }),
    "0": resolveCall({ ...input, step: 0 }),
    "1": resolveCall({ ...input, step: 1 }),
  };
}
