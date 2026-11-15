import type { MacroReading } from "@/server/macro/stats";
import type { MacroHistory } from "@/types/macro";
import type {
  Confidence,
  Factor,
  FactorKey,
  Horizon,
  Scorecard,
  Signal,
} from "@/types/signal";

import { buildMarketState, type DailyClose, type MarketState } from "./market-state";

/**
 * Scorecard — turns the market state into a baseline signal.
 *
 * Why rules and not the model: over 97 daily runs the model, choosing freely,
 * answered HOLD short-term 95 times and BUY long-term 97 times while gold
 * ranged 20% and the dollar and real yields swung both ways. A free choice made
 * alongside a thousand words of narrative converges on whatever is easiest to
 * argue. A sum of measured factors cannot.
 *
 * What this is NOT: a forecast. Replayed over history these rules move with
 * conditions, but they are not shown to predict the next few weeks better than
 * chance — nothing reliably is. They describe whether measured conditions are
 * supportive or challenging *now*, which is exactly what `/methodology` says a
 * signal means. No copy anywhere may claim more than that.
 *
 * Every threshold lives in `RULES`. Changing one changes published calls, so
 * bump `RULES_VERSION` and rerun `npm run outlook:replay` when you do.
 */
export const RULES_VERSION = "2026-11-15.1";

/** Symmetric thresholds: |value| ≥ mild → ±1, |value| ≥ strong → ±2. */
type Ladder = { mild: number; strong?: number };

export const RULES = {
  short: {
    /** |score| needed to open a BUY or SELL baseline. Left through zero. */
    enter: 2,
    factors: {
      /** 20-day return, percent. Rising is supportive. */
      momentum20d: { mild: 2.5, strong: 6 } satisfies Ladder,
      /** Price vs its 50-day average, percent. Above is supportive. */
      trend50d: { mild: 1 } satisfies Ladder,
      /**
       * Contrarian: price stretched this far from its 50-day average is prone
       * to snap back. Offsets `trend50d` at the extremes, so a vertical rally
       * does not score as unambiguously supportive.
       */
      stretch50d: { mild: 7 } satisfies Ladder,
      /** 30-day change in the 10-year real yield, pp. Rising is a headwind. */
      realYield30d: { mild: 0.12, strong: 0.3 } satisfies Ladder,
      /** 30-day change in the broad dollar index, percent. Rising is a headwind. */
      dollar30d: { mild: 0.6, strong: 1.5 } satisfies Ladder,
    },
  },
  long: {
    enter: 2,
    factors: {
      /** Price vs its 200-day average, percent. */
      trend200d: { mild: 2 } satisfies Ladder,
      /** 50-day average vs the 200-day, percent. */
      maCross: { mild: 1 } satisfies Ladder,
      /** 90-day return, percent. */
      return90d: { mild: 5 } satisfies Ladder,
      /**
       * Distance below the 52-week high, percent. Within `near` of the high is
       * supportive; deeper than `deep` marks a damaged trend.
       */
      drawdown52w: { near: 5, deep: 15 },
      /** 90-day change in the 10-year real yield, pp. Rising is a headwind. */
      realYield90d: { mild: 0.25 } satisfies Ladder,
      /** 90-day change in the broad dollar index, percent. Rising is a headwind. */
      dollar90d: { mild: 2 } satisfies Ladder,
    },
  },
  /**
   * Frozen invalidation levels: the closing low/high over `lookback` days when
   * the call opens, never closer to price than `minDistancePct`.
   */
  levels: {
    short: { lookback: 20, minDistancePct: 2 },
    long: { lookback: 90, minDistancePct: 5 },
  },
  /**
   * Consecutive daily readings that must agree before the baseline moves.
   * Factor ladders have edges, and a 20-day return can cross one as a single
   * old day drops out of its window; without this the replay showed calls that
   * lasted one day. A breached level is exempt — a close through a level is a
   * fact, not a reading that might reverse tomorrow.
   */
  confirmDays: 2,
  /**
   * How recent a cited event must be to justify an AI adjustment. A standing
   * narrative ("central banks keep buying") has no date and so justifies none.
   */
  adjustmentRecencyDays: { short: 10, long: 45 },
} as const;

/** Map a measurement onto −2…+2. `direction` −1 inverts (rising = headwind). */
function ladder(value: number | null, rule: Ladder, direction: 1 | -1 = 1): number {
  if (value == null) return 0;
  const magnitude = Math.abs(value);
  const steps =
    rule.strong !== undefined && magnitude >= rule.strong
      ? 2
      : magnitude >= rule.mild
        ? 1
        : 0;
  // `|| 0` normalises −0, which would otherwise leak into JSON as "-0".
  return steps * Math.sign(value) * direction || 0;
}

/** Index-point change expressed as a percent move, so 120→122 reads as +1.7%. */
function pctChange(reading: MacroReading | null, window: "change30d" | "change90d"): number | null {
  const change = reading?.[window];
  if (reading == null || change == null) return null;
  const base = reading.value - change;
  return base === 0 ? null : (change / base) * 100;
}

const factor = (
  key: FactorKey,
  reading: number,
  value: number | null,
  unit: Factor["unit"],
): Factor => ({
  key,
  reading,
  value: value == null ? null : Number(value.toFixed(2)),
  unit,
});

const total = (factors: Factor[]): Scorecard => ({
  score: factors.reduce((sum, f) => sum + f.reading, 0),
  factors,
});

export function scoreShort(state: MarketState): Scorecard {
  const r = RULES.short.factors;
  const realYield = state.macro?.real10y?.change30d ?? null;
  const dollar = pctChange(state.macro?.dollarIndex ?? null, "change30d");

  return total([
    factor("momentum20d", ladder(state.ret20d, r.momentum20d), state.ret20d, "percent"),
    factor("trend50d", ladder(state.pctVsMa50, r.trend50d), state.pctVsMa50, "percent"),
    factor("stretch50d", ladder(state.pctVsMa50, r.stretch50d, -1), state.pctVsMa50, "percent"),
    factor("realYield30d", ladder(realYield, r.realYield30d, -1), realYield, "pp"),
    factor("dollar30d", ladder(dollar, r.dollar30d, -1), dollar, "percent"),
  ]);
}

export function scoreLong(state: MarketState): Scorecard {
  const r = RULES.long.factors;
  const realYield = state.macro?.real10y?.change90d ?? null;
  const dollar = pctChange(state.macro?.dollarIndex ?? null, "change90d");

  // A 52-week high needs most of a year behind it to mean anything.
  const drawdown = state.historyDays >= 200 ? state.drawdownPct : null;
  const drawdownReading =
    drawdown == null
      ? 0
      : drawdown >= -r.drawdown52w.near
        ? 1
        : drawdown <= -r.drawdown52w.deep
          ? -1
          : 0;

  return total([
    factor("trend200d", ladder(state.pctVsMa200, r.trend200d), state.pctVsMa200, "percent"),
    factor("maCross", ladder(state.ma50VsMa200Pct, r.maCross), state.ma50VsMa200Pct, "percent"),
    factor("return90d", ladder(state.ret90d, r.return90d), state.ret90d, "percent"),
    factor("drawdown52w", drawdownReading, drawdown, "percent"),
    factor("realYield90d", ladder(realYield, r.realYield90d, -1), realYield, "pp"),
    factor("dollar90d", ladder(dollar, r.dollar90d, -1), dollar, "percent"),
  ]);
}

export const scoreFor = (horizon: Horizon, state: MarketState): Scorecard =>
  horizon === "short" ? scoreShort(state) : scoreLong(state);

/** Hysteresis alone: what one score implies, given the standing baseline. */
function impliedBaseline(score: number, previous: Signal | null, horizon: Horizon): Signal {
  const { enter } = RULES[horizon];
  if (score >= enter) return "BUY";
  if (score <= -enter) return "SELL";
  if (previous === "BUY" && score > 0) return "BUY";
  if (previous === "SELL" && score < 0) return "SELL";
  return "HOLD";
}

/**
 * Baseline signal, with hysteresis and confirmation.
 *
 * Hysteresis: a directional baseline opens at |score| ≥ `enter` and is only
 * given up when the score crosses back through zero. Without the gap, a score
 * oscillating between 1 and 2 would flip the published call every other day.
 *
 * Confirmation: a move away from the standing baseline must be implied by
 * `confirmDays` consecutive readings — today's and the ones before it, passed
 * as `priorScores` (most recent first). Both exist for the same reason:
 * replacing "never changes" with "changes on noise" is no more useful.
 *
 * `priorScores` shorter than the rule needs (the first call, or thin history)
 * confirms on what there is rather than refusing to move.
 */
export function baselineFrom(
  score: number,
  previous: Signal | null,
  horizon: Horizon,
  priorScores: number[] = [],
  confirmDays: number = RULES.confirmDays,
): Signal {
  const target = impliedBaseline(score, previous, horizon);
  if (previous === null || target === previous) return target;

  const needed = priorScores.slice(0, Math.max(0, confirmDays - 1));
  const confirmed = needed.every((s) => impliedBaseline(s, previous, horizon) === target);
  return confirmed ? target : previous;
}

/**
 * The scores of the `days` readings before the latest close, most recent
 * first — the input `baselineFrom` needs for confirmation.
 *
 * Recomputed from history rather than stored: the outlook is not published
 * every day, so "yesterday's published score" may be a week old. What has to
 * agree is consecutive *market* readings, and those are always available.
 */
export function priorScores(
  horizon: Horizon,
  closes: DailyClose[],
  macro: MacroHistory | null,
  days: number = RULES.confirmDays - 1,
): number[] {
  const scores: number[] = [];
  for (let back = 1; back <= days; back++) {
    const upTo = closes.length - back;
    if (upTo < 1) break;
    const state = buildMarketState({ closes: closes.slice(0, upTo), macro });
    scores.push(scoreFor(horizon, state).score);
  }
  return scores;
}

const NOTCH_DOWN: Record<Confidence, Confidence> = {
  high: "medium",
  medium: "low",
  low: "low",
};

/**
 * Confidence, computed — not chosen.
 *
 * Mirrors the published definitions on `/methodology` literally: *high* when
 * the drivers point the same way, *medium* when at least one significant driver
 * cuts against the call, *low* when the balance is unclear. Left to the model
 * it came back "medium" on 193 of 194 calls, which carries no information.
 */
export function confidenceFor(
  signal: Signal,
  scorecard: Scorecard,
  horizon: Horizon,
  opts: { adjusted: boolean; pinned: boolean },
): Confidence {
  const measured = scorecard.factors.filter((f) => f.value != null);
  // With most of the scorecard unmeasurable, no call is well supported.
  if (measured.length * 2 < scorecard.factors.length) return "low";

  const supportive = measured.filter((f) => f.reading > 0).length;
  const adverse = measured.filter((f) => f.reading < 0).length;
  const { enter } = RULES[horizon];

  let confidence: Confidence;
  if (opts.pinned) {
    // Held by a breached level rather than by the scorecard.
    confidence = "low";
  } else if (signal === "HOLD") {
    if (supportive >= 2 && adverse >= 2) confidence = "low"; // genuinely split
    else if (supportive + adverse <= 1) confidence = "high"; // genuinely flat
    else confidence = "medium";
  } else {
    const agree = signal === "BUY" ? supportive : adverse;
    const oppose = signal === "BUY" ? adverse : supportive;
    const magnitude = Math.abs(scorecard.score);
    if (magnitude < enter) confidence = "low"; // held by hysteresis or adjustment only
    else if (oppose === 0 && agree >= 3) confidence = "high";
    else confidence = "medium";
  }

  // An adjustment means the call rests partly on a judgement about an event,
  // not only on measured conditions.
  return opts.adjusted ? NOTCH_DOWN[confidence] : confidence;
}
