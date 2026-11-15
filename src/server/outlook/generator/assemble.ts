import { RULES_VERSION, type MarketState } from "@/server/outlook/signal";
import type {
  KeyLevel,
  OutlookCall,
  OutlookContext,
  OutlookScorecard,
  Source,
} from "@/types/outlook";
import type { HistoryEntry, Horizon } from "@/types/signal";

import { stepKey } from "./brief";
import { levelText, type GeneratedOutlook, type GenerationInput } from "./schema";

/**
 * Turn a validated model response into the published fields.
 *
 * This is where the division of labour becomes physical: the model's prose is
 * copied across, and everything that is a *decision or a number* — signal,
 * confidence, levels, dates, key levels, scorecard, context — is taken from the
 * brief and the market state. The model's own `signal` is not read here at all;
 * validation has already checked it says the same thing.
 */

/** Fixed, so they are identical every day and translate once per phrasing. */
const LABELS: Record<Horizon, { label: string; horizon: string }> = {
  short: { label: "Short-term", horizon: "Next 1–4 weeks" },
  long: { label: "Long-term", horizon: "Next 3–12 months" },
};

const round2 = (n: number | null): number | null => (n == null ? null : Number(n.toFixed(2)));

export function assembleCalls(g: GeneratedOutlook, input: GenerationInput): OutlookCall[] {
  return (["short", "long"] as const).map((horizon) => {
    const request = g.adjustments[horizon];
    const { call } = input.briefs[horizon].outcomes[stepKey(request.step)];
    const prose = g.calls.find((c) => c.term === horizon)!;

    return {
      term: horizon,
      ...LABELS[horizon],
      signal: call.signal,
      confidence: call.confidence,
      reason: prose.reason,
      invalidation: prose.invalidation,
      since: call.since,
      ...(call.previous ? { previous: call.previous } : {}),
      ...(call.change ? { change: call.change } : {}),
      levels: call.levels,
      baseline: call.baseline,
      // Recorded only when it is in effect: a requested step that validation
      // let through always is, but a carried call's `adjustmentStep` is the
      // source of truth.
      ...(call.adjustmentStep !== 0 && request.step !== 0
        ? {
            adjustment: {
              step: call.adjustmentStep,
              reason: (request.reason ?? "").trim(),
              driverIndexes: request.driverIndexes ?? [],
            },
          }
        : {}),
    };
  });
}

/** What `history.json` gains if this outlook is published. */
export function historyEntryFor(
  g: GeneratedOutlook,
  input: GenerationInput,
  promptVersion: string,
): HistoryEntry {
  const standing = (horizon: Horizon) => {
    const { call } = input.briefs[horizon].outcomes[stepKey(g.adjustments[horizon].step)];
    return { signal: call.signal, confidence: call.confidence, standing: call };
  };
  return {
    date: input.date,
    spot: input.spot.price,
    rulesVersion: RULES_VERSION,
    promptVersion,
    calls: { short: standing("short"), long: standing("long") },
  };
}

/**
 * Key levels, from data. The model used to write these, which made the grid a
 * place where an invented number could be published under a factual-looking
 * label. Every value here is a measurement.
 */
export function keyLevelsFrom(state: MarketState): KeyLevel[] {
  const levels: (KeyLevel | null)[] = [
    { label: "Spot", value: levelText(state.price), emphasis: true },
    state.low20d == null ? null : { label: "20-day low", value: levelText(state.low20d) },
    state.high20d == null ? null : { label: "20-day high", value: levelText(state.high20d) },
    state.ma50 == null ? null : { label: "50-day average", value: levelText(state.ma50) },
    state.ma200 == null ? null : { label: "200-day average", value: levelText(state.ma200) },
    { label: "52-week high", value: levelText(state.high52w.price) },
  ];
  return levels.filter((level): level is KeyLevel => level !== null);
}

export function contextFrom(state: MarketState): OutlookContext {
  return {
    asOf: state.asOf,
    high52w: { price: Number(state.high52w.price.toFixed(2)), date: state.high52w.date },
    drawdownPct: Number(state.drawdownPct.toFixed(2)),
    ma50: round2(state.ma50),
    ma200: round2(state.ma200),
    ret20d: round2(state.ret20d),
    ret90d: round2(state.ret90d),
    ret365d: round2(state.ret365d),
  };
}

export function scorecardFrom(input: GenerationInput): OutlookScorecard {
  return {
    rulesVersion: RULES_VERSION,
    short: input.briefs.short.scorecard,
    long: input.briefs.long.scorecard,
  };
}

/**
 * The model's sources, plus any driver URL it did not also list — a reader
 * following an adjustment back to its event must find that event cited.
 */
export function sourcesFrom(g: GeneratedOutlook): Source[] {
  const seen = new Set(g.sources.map((s) => s.url));
  const extra = g.drivers
    .filter((d) => !seen.has(d.url) && seen.add(d.url))
    .map((d) => ({ title: d.title, url: d.url }));
  return [...g.sources, ...extra];
}
