/**
 * Guards the rules that set the outlook's BUY / HOLD / SELL — `npm run check:signal`.
 *
 * These rules decide what a YMYL page tells readers about gold, so each
 * property the design depends on is pinned here as a fixture: thresholds,
 * hysteresis, computed confidence, frozen levels, and above all that a breached
 * level FORCES a change that an adjustment cannot undo. The old pipeline's
 * failure was exactly that nothing could force a change.
 *
 * Offline and deterministic — no network, no clock. The companion
 * `npm run outlook:replay` runs the same code over real history.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readingAsOf } from "@/server/macro/stats";
import {
  advisoriesFor,
  assembleCalls,
  buildBrief,
  buildGeneratedSchema,
  contextFrom,
  historyEntryFor,
  keyLevelsFrom,
  scorecardFrom,
  sourcesFrom,
  validateGenerated,
  type GeneratedOutlook,
  type GenerationInput,
} from "@/server/outlook/generator";
import { createMockGenerator } from "@/server/outlook/generator/mock";
import { adviceFraming, levelText, recordClaims } from "@/server/outlook/generator/schema";
import {
  artifactIssues,
  outlookDir,
  readHistory,
} from "@/server/outlook/signal";
import { CONTRACT_VERSION, outlookReportSchema, type OutlookReport } from "@/types/outlook";
import type { Driver, HistoryEntry } from "@/types/signal";
import {
  RULES,
  baselineFrom,
  buildMarketState,
  confidenceFor,
  deriveLevels,
  findBreach,
  priorScores,
  resolveCall,
  scoreLong,
  scoreShort,
  toDailyCloses,
  type DailyClose,
  type MarketState,
  type StandingCall,
} from "@/server/outlook/signal";
import type { MacroObservation } from "@/types/macro";
import type { Factor, Scorecard } from "@/types/signal";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${label}`);
    console.error(`       ${(err as Error).message.split("\n")[0]}`);
  }
}

/* ------------------------------- helpers --------------------------------- */

const iso = (dayIndex: number): string =>
  new Date(Date.UTC(2026, 0, 1) + dayIndex * 86_400_000).toISOString().slice(0, 10);

/** `count` daily closes from 2026-01-01, priced by `price(i)`. */
const series = (count: number, price: (i: number) => number): DailyClose[] =>
  Array.from({ length: count }, (_, i) => ({ date: iso(i), close: price(i) }));

const reading = (value: number, change30d: number | null, change90d: number | null) => ({
  value,
  asOf: "2026-06-01",
  change30d,
  change90d,
  pctile1y: null,
});

/** A neutral market state; each fixture overrides only what it tests. */
function stateWith(overrides: Partial<MarketState> = {}): MarketState {
  return {
    asOf: "2026-06-01",
    price: 4000,
    historyDays: 365,
    ret20d: 0,
    ret90d: 0,
    ret365d: 0,
    ma50: 4000,
    ma200: 4000,
    pctVsMa50: 0,
    pctVsMa200: 0,
    ma50VsMa200Pct: 0,
    high52w: { price: 4400, date: "2026-02-01" },
    low52w: { price: 3600, date: "2025-08-01" },
    drawdownPct: -9.09,
    low20d: 3900,
    high20d: 4100,
    low90d: 3700,
    high90d: 4300,
    vol20dPct: 15,
    macro: {
      dollarIndex: reading(120, 0, 0),
      real10y: reading(2.5, 0, 0),
      nominal10y: reading(4.8, 0, 0),
    },
    ...overrides,
  };
}

const readingOf = (card: Scorecard, key: Factor["key"]): number =>
  card.factors.find((f) => f.key === key)!.reading;

/** A scorecard with the given readings, all measured. */
const cardOf = (...readings: number[]): Scorecard => ({
  score: readings.reduce((a, b) => a + b, 0),
  factors: readings.map((r, i) => ({
    key: (["momentum20d", "trend50d", "stretch50d", "realYield30d", "dollar30d"] as const)[i % 5]!,
    reading: r,
    value: r,
    unit: "percent" as const,
  })),
});

const standing = (overrides: Partial<StandingCall> = {}): StandingCall => ({
  horizon: "short",
  signal: "HOLD",
  confidence: "medium",
  since: "2026-05-01",
  levels: { below: 3900, above: 4100, setOn: "2026-05-01", basis: "daily-close" },
  baseline: "HOLD",
  score: 0,
  adjustmentStep: 0,
  pinned: false,
  lastChecked: "2026-05-31",
  ...overrides,
});

const close = (date: string, value: number): DailyClose => ({ date, close: value });

/* -------------------------------- data ----------------------------------- */

console.log("\nData preparation");

check("daily closes keep midnight readings and drop the live point", () => {
  const midnight = Date.UTC(2026, 10, 14);
  const closes = toDailyCloses([
    { t: midnight, price: 3874 },
    { t: midnight + 86_400_000, price: 3799 },
    { t: midnight + 86_400_000 + 40_470_000, price: 3823 }, // "right now"
  ]);
  assert.deepEqual(closes, [
    { date: "2026-11-14", close: 3874 },
    { date: "2026-11-15", close: 3799 },
  ]);
});

check("market state: averages, returns and drawdown", () => {
  // 200 days at 4000, then 50 days at 4400.
  const closes = series(250, (i) => (i < 200 ? 4000 : 4400));
  const state = buildMarketState({ closes, macro: null });
  assert.equal(state.ma50, 4400);
  assert.equal(state.ma200, (150 * 4000 + 50 * 4400) / 200);
  assert.equal(Math.round(state.ret90d!), 10);
  assert.equal(state.drawdownPct, 0);
  assert.equal(state.macro, null);
});

check("market state: short history nulls the long windows, never guesses", () => {
  const state = buildMarketState({ closes: series(60, () => 4000), macro: null });
  assert.equal(state.ma200, null);
  assert.equal(state.pctVsMa200, null);
  assert.equal(state.ret90d, null);
  assert.notEqual(state.ma50, null);
});

check("market state: `asOf` ignores everything after it", () => {
  const closes = series(100, (i) => (i < 80 ? 4000 : 9999));
  const state = buildMarketState({ closes, macro: null, asOf: iso(79) });
  assert.equal(state.asOf, iso(79));
  assert.equal(state.high52w.price, 4000);
});

check("market state: the live price can itself be the 52-week high", () => {
  const state = buildMarketState({ closes: series(60, () => 4000), macro: null, spot: 4200 });
  assert.equal(state.high52w.price, 4200);
  assert.equal(state.drawdownPct, 0);
});

check("macro reading: change uses the nearest observation on or before the cutoff", () => {
  const obs: MacroObservation[] = [
    { date: "2026-04-28", value: 2.0 }, // a Tuesday; the 30-day cutoff lands on a gap
    { date: "2026-05-29", value: 2.4 },
    { date: "2026-06-01", value: 2.5 },
  ];
  const r = readingAsOf(obs)!;
  assert.equal(r.asOf, "2026-06-01");
  assert.equal(Number(r.change30d!.toFixed(2)), 0.5);
  assert.equal(r.change90d, null);
  assert.equal(r.pctile1y, null); // three observations are not a year
});

check("macro reading: `asOf` returns the reading known on that date", () => {
  const obs: MacroObservation[] = [
    { date: "2026-05-01", value: 2.0 },
    { date: "2026-06-01", value: 3.0 },
  ];
  assert.equal(readingAsOf(obs, "2026-05-15")!.value, 2.0);
  assert.equal(readingAsOf(obs, "2026-04-01"), null);
});

/* ------------------------------ scorecard -------------------------------- */

console.log("\nScorecard");

check("momentum ladder: thresholds are inclusive and symmetric", () => {
  const at = (ret20d: number) => readingOf(scoreShort(stateWith({ ret20d })), "momentum20d");
  assert.equal(at(2.4), 0);
  assert.equal(at(2.5), 1);
  assert.equal(at(6), 2);
  assert.equal(at(-2.5), -1);
  assert.equal(at(-6), -2);
});

check("rising real yields and a rising dollar are headwinds", () => {
  const card = scoreShort(
    stateWith({
      macro: {
        // 120 → 121.2 is +1.0%: past `mild` (0.6), short of `strong` (1.5).
        dollarIndex: reading(121.2, 1.2, null),
        real10y: reading(2.8, 0.3, null),
        nominal10y: reading(5, 0, null),
      },
    }),
  );
  assert.equal(readingOf(card, "realYield30d"), -2);
  assert.equal(readingOf(card, "dollar30d"), -1);
  assert.equal(card.score, -3);
});

check("a stretched rally is offset, not scored as pure support", () => {
  const card = scoreShort(stateWith({ pctVsMa50: 8 }));
  assert.equal(readingOf(card, "trend50d"), 1);
  assert.equal(readingOf(card, "stretch50d"), -1);
});

check("missing macro data reads neutral and is marked unmeasured", () => {
  const card = scoreShort(stateWith({ macro: null }));
  const yieldFactor = card.factors.find((f) => f.key === "realYield30d")!;
  assert.equal(yieldFactor.reading, 0);
  assert.equal(yieldFactor.value, null);
});

check("drawdown: near the high supports, a deep one is adverse", () => {
  const at = (drawdownPct: number, historyDays = 365) =>
    scoreLong(stateWith({ drawdownPct, historyDays })).factors.find(
      (f) => f.key === "drawdown52w",
    )!;
  assert.equal(at(-3).reading, 1);
  assert.equal(at(-10).reading, 0);
  assert.equal(at(-20).reading, -1);
  assert.equal(at(-20, 120).value, null); // too little history for a 52-week high
});

check("a year 25% off its high and under its 200-day average does not score BUY", () => {
  // The regime every long-term BUY of 2026 was published into.
  const card = scoreLong(
    stateWith({ pctVsMa200: -9, ma50VsMa200Pct: -6, ret90d: -8, drawdownPct: -25 }),
  );
  assert.equal(card.score, -4);
  assert.equal(baselineFrom(card.score, null, "long"), "SELL");
});

check("no reading serialises as -0", () => {
  const json = JSON.stringify([scoreShort(stateWith()), scoreLong(stateWith())]);
  assert.ok(!json.includes("-0,") && !json.includes("-0}"), json);
});

check("hysteresis: opens at the threshold, leaves only through zero", () => {
  assert.equal(baselineFrom(2, "HOLD", "short"), "BUY");
  assert.equal(baselineFrom(1, "BUY", "short"), "BUY"); // weakened, still held
  assert.equal(baselineFrom(1, "HOLD", "short"), "HOLD"); // not enough to open
  assert.equal(baselineFrom(0, "BUY", "short"), "HOLD");
  assert.equal(baselineFrom(-2, "HOLD", "short"), "SELL");
  assert.equal(baselineFrom(-1, "SELL", "short"), "SELL");
  assert.equal(baselineFrom(1, "SELL", "short"), "HOLD");
  assert.equal(baselineFrom(1, null, "short"), "HOLD");
});

check("confirmation: one reading is not enough to move the baseline", () => {
  // Today says BUY; yesterday's reading did not.
  assert.equal(baselineFrom(2, "HOLD", "short", [1]), "HOLD");
  // Both agree.
  assert.equal(baselineFrom(2, "HOLD", "short", [3]), "BUY");
  // Leaving a call needs confirming too.
  assert.equal(baselineFrom(0, "BUY", "short", [1]), "BUY");
  assert.equal(baselineFrom(0, "BUY", "short", [-1]), "HOLD");
});

check("confirmation: the readings must agree on the SAME new baseline", () => {
  // Yesterday implied HOLD, today implies SELL — neither is confirmed yet.
  assert.equal(baselineFrom(-2, "BUY", "short", [0]), "BUY");
  assert.equal(baselineFrom(-2, "BUY", "short", [-3]), "SELL");
});

check("confirmation: staying put never needs confirming; thin history does not block", () => {
  assert.equal(baselineFrom(3, "BUY", "short", [-5]), "BUY");
  assert.equal(baselineFrom(2, "HOLD", "short", []), "BUY");
  assert.equal(baselineFrom(2, null, "short", [-5]), "BUY"); // first call
});

check("prior scores are recomputed from market history, most recent first", () => {
  // Flat, then a 10% jump on the final day only: every earlier reading is flat.
  const closes = series(120, (i) => (i < 119 ? 4000 : 4400));
  assert.deepEqual(priorScores("short", closes, null, 2), [0, 0]);
  assert.equal(scoreShort(buildMarketState({ closes, macro: null })).score > 0, true);
});

/* ------------------------------ confidence ------------------------------- */

console.log("\nConfidence");

const plain = { adjusted: false, pinned: false };

check("high: three or more drivers agree and none opposes", () => {
  assert.equal(confidenceFor("BUY", cardOf(1, 1, 1, 0, 0), "short", plain), "high");
  assert.equal(confidenceFor("SELL", cardOf(-2, -1, -1, 0, 0), "short", plain), "high");
});

check("medium: the call stands but a driver cuts the other way", () => {
  assert.equal(confidenceFor("BUY", cardOf(2, 1, 1, -1, 0), "short", plain), "medium");
});

check("low: a directional call the score no longer supports on its own", () => {
  assert.equal(confidenceFor("BUY", cardOf(1, 0, 0, 0, 0), "short", plain), "low");
});

check("HOLD: split evidence is low, a flat market is high", () => {
  assert.equal(confidenceFor("HOLD", cardOf(1, 1, -1, -1, 0), "short", plain), "low");
  assert.equal(confidenceFor("HOLD", cardOf(0, 0, 0, 0, 0), "short", plain), "high");
  assert.equal(confidenceFor("HOLD", cardOf(1, 0, -1, 0, 0), "short", plain), "medium");
});

check("an adjustment costs one notch; a pinned call is low", () => {
  const card = cardOf(1, 1, 1, 0, 0);
  assert.equal(confidenceFor("BUY", card, "short", { adjusted: true, pinned: false }), "medium");
  assert.equal(confidenceFor("BUY", card, "short", { adjusted: false, pinned: true }), "low");
});

check("low when most of the scorecard could not be measured", () => {
  const card: Scorecard = {
    score: 3,
    factors: cardOf(1, 1, 1, 0, 0).factors.map((f, i) => (i < 3 ? { ...f, value: null } : f)),
  };
  assert.equal(confidenceFor("BUY", card, "short", plain), "low");
});

/* -------------------------------- levels --------------------------------- */

console.log("\nLevels");

check("BUY can only break down, SELL only up, HOLD either way", () => {
  const s = stateWith();
  assert.deepEqual(Object.keys(deriveLevels("BUY", "short", s, "2026-06-01")).sort(), [
    "basis",
    "below",
    "setOn",
  ]);
  assert.equal(deriveLevels("SELL", "short", s, "2026-06-01").below, undefined);
  const hold = deriveLevels("HOLD", "short", s, "2026-06-01");
  assert.ok(hold.below !== undefined && hold.above !== undefined);
});

check("levels use the window's closing extremes", () => {
  const short = deriveLevels("HOLD", "short", stateWith(), "2026-06-01");
  assert.equal(short.below, 3900);
  assert.equal(short.above, 4100);
  const long = deriveLevels("HOLD", "long", stateWith(), "2026-06-01");
  assert.equal(long.below, 3700);
  assert.equal(long.above, 4300);
});

check("levels are never closer than the minimum distance", () => {
  // Price sitting on its 20-day low: the level must not be the price itself.
  const s = stateWith({ price: 4000, low20d: 4000, high20d: 4010 });
  const levels = deriveLevels("HOLD", "short", s, "2026-06-01");
  const min = RULES.levels.short.minDistancePct / 100;
  assert.equal(levels.below, Math.floor(4000 * (1 - min)));
  assert.equal(levels.above, Math.ceil(4000 * (1 + min)));
});

check("a close AT the level is not a breach; the first breach in order wins", () => {
  const levels = { below: 3900, above: 4100, setOn: "2026-05-01", basis: "daily-close" as const };
  assert.equal(findBreach(levels, [close("2026-06-01", 3900)]), null);
  const breach = findBreach(levels, [
    close("2026-06-01", 3950),
    close("2026-06-02", 4120),
    close("2026-06-03", 3800),
  ])!;
  assert.equal(breach.side, "above");
  assert.equal(breach.date, "2026-06-02");
});

/* ------------------------------ resolution ------------------------------- */

console.log("\nStanding calls");

const base = {
  horizon: "short" as const,
  state: stateWith(),
  today: "2026-06-01",
  newCloses: [close("2026-06-01", 4000)],
};

check("first call under the rules is labelled a methodology change", () => {
  const { call, changed } = resolveCall({
    ...base,
    previous: null,
    scorecard: cardOf(-1, -1, 0, 0, 0),
    step: 0,
  });
  assert.equal(call.signal, "SELL");
  assert.equal(call.since, "2026-06-01");
  assert.equal(call.change?.reason, "methodology_change");
  assert.equal(changed, false);
});

check("an unchanged call keeps its date and its FROZEN levels", () => {
  // The 20-day range has moved a long way since the call opened.
  const moved = stateWith({ price: 3950, low20d: 3500, high20d: 3960 });
  const { call, changed } = resolveCall({
    ...base,
    state: moved,
    previous: standing(),
    scorecard: cardOf(0, 0, 0, 0, 0),
    newCloses: [close("2026-06-01", 3950)],
    step: 0,
  });
  assert.equal(changed, false);
  assert.equal(call.since, "2026-05-01");
  assert.deepEqual(call.levels, standing().levels);
});

check("a breached level FORCES the call to move, with the scorecard unmoved", () => {
  const { call, breach, changed } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(0, 0, 0, 0, 0), // baseline still HOLD
    newCloses: [close("2026-06-01", 3880)],
    step: 0,
  });
  assert.equal(breach?.side, "below");
  assert.equal(changed, true);
  assert.equal(call.signal, "SELL");
  assert.equal(call.pinned, true);
  assert.equal(call.confidence, "low");
  assert.equal(call.change?.reason, "invalidation_hit");
  assert.deepEqual(call.previous, { signal: "HOLD", until: "2026-06-01" });
  assert.equal(call.since, "2026-06-01");
  assert.equal(call.levels.setOn, "2026-06-01");
});

check("an adjustment cannot undo a breach", () => {
  const { call } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(0, 0, 0, 0, 0),
    newCloses: [close("2026-06-01", 3880)],
    step: 1, // "but there is good news"
  });
  assert.equal(call.signal, "SELL");
  assert.equal(call.adjustmentStep, 0);
});

check("a pinned call does not bounce back the next day, adjustment or not", () => {
  const pinned = standing({
    signal: "SELL",
    pinned: true,
    since: "2026-06-01",
    levels: { above: 4100, setOn: "2026-06-01", basis: "daily-close" },
  });
  for (const step of [0, 1] as const) {
    const { call, changed } = resolveCall({
      ...base,
      today: "2026-06-02",
      previous: pinned,
      scorecard: cardOf(0, 0, 0, 0, 0),
      newCloses: [close("2026-06-02", 3890)],
      step,
    });
    assert.equal(changed, false, `step ${step}`);
    assert.equal(call.signal, "SELL");
    assert.equal(call.pinned, true);
    assert.equal(call.adjustmentStep, 0);
  }
});

check("a pin releases when the baseline itself moves", () => {
  const pinned = standing({
    signal: "SELL",
    pinned: true,
    baseline: "HOLD",
    levels: { above: 4100, setOn: "2026-06-01", basis: "daily-close" },
  });
  const { call } = resolveCall({
    ...base,
    previous: pinned,
    scorecard: cardOf(2, 1, 0, 0, 0), // baseline → BUY
    step: 0,
  });
  assert.equal(call.signal, "BUY");
  assert.equal(call.pinned, false);
  assert.equal(call.change?.reason, "evidence_shift");
});

check("BUY broken downward steps to HOLD, not straight to SELL", () => {
  const buy = standing({
    signal: "BUY",
    baseline: "BUY",
    levels: { below: 3900, setOn: "2026-05-01", basis: "daily-close" },
  });
  const { call } = resolveCall({
    ...base,
    previous: buy,
    scorecard: cardOf(1, 1, 0, 0, 0), // baseline still BUY
    newCloses: [close("2026-06-01", 3880)],
    step: 0,
  });
  assert.equal(call.signal, "HOLD");
  assert.equal(call.pinned, true);
  assert.ok(call.levels.below !== undefined && call.levels.above !== undefined);
});

check("an unconfirmed baseline shift does not move the published call", () => {
  const { call, changed } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(-2, -1, 0, 0, 0),
    priorScores: [0], // yesterday's reading was neutral
    step: 0,
  });
  assert.equal(changed, false);
  assert.equal(call.signal, "HOLD");
  assert.equal(call.baseline, "HOLD");
});

check("a breach is exempt from confirmation — a close through a level is a fact", () => {
  const { call } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(0, 0, 0, 0, 0),
    priorScores: [0],
    newCloses: [close("2026-06-01", 3880)],
    step: 0,
  });
  assert.equal(call.signal, "SELL");
  assert.equal(call.change?.reason, "invalidation_hit");
});

check("a baseline shift moves the call and says why", () => {
  const { call, changed } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(-2, -1, 0, 0, 0),
    priorScores: [-3],
    step: 0,
  });
  assert.equal(changed, true);
  assert.equal(call.signal, "SELL");
  assert.equal(call.change?.reason, "evidence_shift");
  assert.equal(call.pinned, false);
});

check("an adjustment moves the call exactly one step and lowers confidence", () => {
  const { call } = resolveCall({
    ...base,
    previous: standing(),
    scorecard: cardOf(0, 0, 0, 0, 0),
    step: 1,
  });
  assert.equal(call.signal, "BUY");
  assert.equal(call.baseline, "HOLD");
  assert.equal(call.adjustmentStep, 1);
  assert.equal(call.change?.reason, "event_adjustment");
  assert.equal(call.confidence, "low");
});

check("when the adjustment lapses the call returns to the baseline", () => {
  const adjusted = standing({
    signal: "BUY",
    baseline: "HOLD",
    adjustmentStep: 1,
    levels: { below: 3900, setOn: "2026-05-20", basis: "daily-close" },
  });
  const { call } = resolveCall({
    ...base,
    previous: adjusted,
    scorecard: cardOf(0, 0, 0, 0, 0),
    step: 0,
  });
  assert.equal(call.signal, "HOLD");
  assert.equal(call.change?.reason, "adjustment_ended");
});

check("an adjustment past the end of the scale has no effect", () => {
  const buy = standing({
    signal: "BUY",
    baseline: "BUY",
    levels: { below: 3900, setOn: "2026-05-01", basis: "daily-close" },
  });
  const { call, changed } = resolveCall({
    ...base,
    previous: buy,
    scorecard: cardOf(2, 1, 1, 0, 0),
    step: 1,
  });
  assert.equal(changed, false);
  assert.equal(call.adjustmentStep, 0);
  assert.equal(call.confidence, "high"); // nothing was adjusted, so no notch
});

check("the reason and predecessor are carried while the call stands", () => {
  const prior = standing({
    signal: "SELL",
    baseline: "SELL",
    levels: { above: 4100, setOn: "2026-05-01", basis: "daily-close" },
    previous: { signal: "HOLD", until: "2026-05-01" },
    change: { reason: "evidence_shift", date: "2026-05-01" },
  });
  const { call } = resolveCall({
    ...base,
    previous: prior,
    scorecard: cardOf(-2, -1, 0, 0, 0),
    step: 0,
  });
  assert.deepEqual(call.previous, prior.previous);
  assert.deepEqual(call.change, prior.change);
  assert.equal(call.lastChecked, base.state.asOf);
});

/* ------------------------- what the model may write ---------------------- */

console.log("\nGenerated output");

// A steadily falling year: short-term baseline HOLD (both adjustments have an
// effect), long-term baseline SELL (only +1 does). The last published outlook
// predates the rules.
const fallingCloses = series(260, (i) => 4400 - i * 2);
const today = fallingCloses.at(-1)!.date;
const fallingState = buildMarketState({ closes: fallingCloses, macro: null });
const preRules: HistoryEntry = {
  date: iso(258),
  spot: 3884,
  legacy: true,
  calls: {
    short: { signal: "HOLD", confidence: "medium" },
    long: { signal: "BUY", confidence: "medium" },
  },
};
const briefFor = (horizon: "short" | "long", previousEntry: HistoryEntry | null = preRules, on = today) =>
  buildBrief({ horizon, state: fallingState, closes: fallingCloses, macro: null, previousEntry, today: on });

const input: GenerationInput = {
  date: today,
  spot: { price: fallingState.price, changePct24h: -0.05, asOf: `${today}T06:00:00.000Z` },
  state: fallingState,
  macro: null,
  briefs: { short: briefFor("short"), long: briefFor("long") },
};

const valid = await createMockGenerator().generate(input);
const clone = (): GeneratedOutlook => structuredClone(valid);
const messagesOf = (g: GeneratedOutlook): string => validateGenerated(g, input).map((i) => i.message).join(" | ");

const driver = (overrides: Partial<Driver> = {}): Driver => ({
  title: "Central bank cuts its policy rate",
  direction: "bullish",
  horizon: "short",
  eventDate: iso(257),
  summary: "A dated event the scorecard cannot yet see.",
  url: "https://example.com/event",
  ...overrides,
});

/** A response requesting a short-term +1, written correctly for that outcome. */
function adjustedUp(cited: Driver): GeneratedOutlook {
  const g = clone();
  const outcome = input.briefs.short.outcomes["1"].call;
  g.drivers = [cited, g.drivers[0]!];
  g.adjustments.short = { step: 1, reason: "A rate cut landed this week.", driverIndexes: [0] };
  g.calls[0] = {
    term: "short",
    signal: outcome.signal,
    reason: "Conditions improved on the policy surprise.",
    invalidation: `This view would change on a daily close below ${levelText(outcome.levels.below!)}.`,
  };
  return g;
}

check("the fixture is the case it claims to be", () => {
  assert.equal(input.briefs.short.outcomes["0"].call.signal, "HOLD");
  assert.deepEqual(input.briefs.short.effectiveSteps, [-1, 1]);
  assert.equal(input.briefs.long.outcomes["0"].call.signal, "SELL");
  assert.deepEqual(input.briefs.long.effectiveSteps, [1]);
  assert.ok(fallingState.drawdownPct < -3);
});

check("an unadjusted, correctly written response has no issues", () => {
  assert.equal(messagesOf(valid), "");
  assert.equal(buildGeneratedSchema(input).safeParse(valid).success, true);
});

check("the model cannot state a signal the rules did not give", () => {
  const g = clone();
  g.calls[0]!.signal = "BUY";
  assert.match(messagesOf(g), /the rules give HOLD, not BUY/);
  const parsed = buildGeneratedSchema(input).safeParse(g);
  assert.equal(parsed.success, false);
});

check("the invalidation prose must quote the frozen level exactly", () => {
  const g = clone();
  g.calls[1]!.invalidation = "A decisive move higher would change this view.";
  assert.match(messagesOf(g), /must state the level \$/);
});

check("an adjustment with a recent, cited, same-direction event is accepted", () => {
  assert.equal(messagesOf(adjustedUp(driver())), "");
});

check("an adjustment without a cited event is rejected", () => {
  const g = adjustedUp(driver());
  g.adjustments.short.driverIndexes = [];
  assert.match(messagesOf(g), /must cite at least one driver/);
  g.adjustments.short.driverIndexes = [9];
  assert.match(messagesOf(g), /valid index/);
});

check("a stale event cannot justify an adjustment — a standing narrative has no date", () => {
  const stale = driver({ eventDate: iso(259 - RULES.adjustmentRecencyDays.short - 1) });
  assert.match(messagesOf(adjustedUp(stale)), /within the last 10 days/);
  // Exactly at the edge of the window is still recent.
  const edge = driver({ eventDate: iso(259 - RULES.adjustmentRecencyDays.short) });
  assert.equal(messagesOf(adjustedUp(edge)), "");
});

check("an event that points the other way, is undated-future, or is for another horizon is rejected", () => {
  assert.match(messagesOf(adjustedUp(driver({ direction: "bearish" }))), /must cite a bullish driver/);
  assert.match(messagesOf(adjustedUp(driver({ direction: "neutral" }))), /must cite a bullish driver/);
  assert.match(messagesOf(adjustedUp(driver({ eventDate: iso(262) }))), /on or before/);
  assert.match(messagesOf(adjustedUp(driver({ horizon: "long" }))), /applies to the short term/);
  assert.equal(messagesOf(adjustedUp(driver({ horizon: "both" }))), "");
});

check("an adjustment that would change nothing must be 0", () => {
  const g = clone();
  g.drivers = [driver({ direction: "bearish", horizon: "long" }), g.drivers[0]!];
  g.adjustments.long = { step: -1, reason: "Worse still.", driverIndexes: [0] };
  assert.match(messagesOf(g), /has no effect on the long-term call today/);
});

check("advice framing is flagged in the reason and the summary", () => {
  const g = clone();
  g.calls[0]!.reason = "Accumulate gradually rather than all at once.";
  assert.match(advisoriesFor(g, input).join(" | "), /short-term reason: "Accumulate" reads as advice/);
  const s = clone();
  s.summary = "Chasing it lower is risky here.";
  assert.match(advisoriesFor(s, input).join(" | "), /summary: "Chasing" reads as advice/);
  assert.deepEqual(advisoriesFor(valid, input), []);
});

check("a wording flag never fails validation — it is a judgement, not a rule", () => {
  // The first live run was lost to exactly this: a correct sentence, matched
  // by a pattern, rejected twice. Prose flags must not be able to do that.
  const g = clone();
  g.calls[0]!.reason = "Accumulate gradually rather than all at once.";
  g.analysisMarkdown += "\n\nGold sits near record territory today.";
  assert.equal(advisoriesFor(g, input).length, 2);
  assert.equal(messagesOf(g), "");
  assert.equal(buildGeneratedSchema(input).safeParse(g).success, true);
});

check("advice lint: catches the old calls' vocabulary, leaves description alone", () => {
  for (const text of [
    "Patience beats a fresh entry; don't chase it lower.",
    "Wait rather than catch a falling knife.",
    "We lean BUY via dollar-cost averaging.",
    "Scale in on weakness rather than all at once.",
    "The pullback offers a better entry.",
    "A reset long-term investors can accumulate into.",
  ]) {
    assert.notEqual(adviceFraming(text), null, text);
  }
  for (const text of [
    "Momentum is negative and the dollar is firm, so conditions are adverse.",
    "Central-bank purchases remain a support.", // "purchases" is not "chase"
    "Real yields eased, which is supportive.",
    // What a buyer is doing is description, not advice to the reader.
    "Central banks keep accumulating reserves at a steady pace.",
    "Official-sector accumulation continued in October.",
  ]) {
    assert.equal(adviceFraming(text), null, text);
  }
});

check("record lint: flags the sentences that were actually published", () => {
  // Verbatim from outlooks published with the price 20–30% below its high.
  for (const text of [
    "Gold trades at a fresh record near $4,396, up 0.9% on the day.",
    "Gold sits near record territory at $4,446.",
    "Gold is consolidating just below record territory near $4,108.",
    "Real yields are high by the standards of the past decade, yet gold is still trading near record territory.",
    "With price already at record highs, there is no overhead supply from history.",
  ]) {
    assert.equal(recordClaims(text, fallingState).length, 1, text);
  }
});

check("record lint: leaves accurate and unrelated uses of the word alone", () => {
  for (const text of [
    "After setting an all-time high near $5,589 on January 28, 2026, gold has shed over a quarter of its value.",
    "Spot is 30.4% below its 52-week high of $5,496.",
    "Gold has retreated from record territory reached earlier in the year.",
    "Global ETF holdings are at a record high despite the price slide.",
    "Central banks are buying at a record pace.",
    "The broad dollar is at a new high for the year.",
    "Gold remains well below record territory.",
    // Verbatim from the first live run — correct, and it cost that run.
    "This is the opposite of record territory — it is the weakest the metal has been in a year.",
    "Gold is nowhere near record territory.",
    "The price isn't at a record; it is at a one-year low.",
  ]) {
    assert.deepEqual(recordClaims(text, fallingState), [], text);
  }
});

check("record lint: silent when the price really is at its high", () => {
  const atHigh = stateWith({ drawdownPct: -0.4 });
  assert.deepEqual(recordClaims("Gold trades at a fresh record near $4,396.", atHigh), []);
});

check("a record claim in the analysis is flagged, with the real figures in the note", () => {
  const g = clone();
  g.analysisMarkdown += "\n\nGold sits near record territory today.";
  assert.match(advisoriesFor(g, input).join(" | "), /analysis: .*% below the 52-week high of \$4,400/);
});

/* -------------------------------- assembly ------------------------------- */

console.log("\nAssembly");

check("signal, confidence and levels come from the rules, not from the model's text", () => {
  const g = clone();
  g.calls[0]!.signal = "BUY"; // would fail validation; assembly must not even read it
  const [short, long] = assembleCalls(g, input);
  assert.equal(short!.signal, "HOLD");
  assert.equal(long!.signal, "SELL");
  assert.equal(short!.confidence, input.briefs.short.outcomes["0"].call.confidence);
  assert.deepEqual(long!.levels, input.briefs.long.outcomes["0"].call.levels);
  assert.equal(short!.label, "Short-term");
  assert.equal(long!.horizon, "Next 3–12 months");
});

check("the first rule-based call records what it replaced, and why", () => {
  const [short, long] = assembleCalls(valid, input);
  // Long-term went BUY → SELL; short-term stayed HOLD, so it replaced nothing.
  assert.deepEqual(long!.previous, { signal: "BUY", until: today });
  assert.equal(long!.change?.reason, "methodology_change");
  assert.equal(short!.previous, undefined);
  assert.equal(short!.since, today);
});

check("an adjustment is recorded on the call, with its cited events", () => {
  const [short] = assembleCalls(adjustedUp(driver()), input);
  assert.equal(short!.signal, "BUY");
  assert.equal(short!.baseline, "HOLD");
  assert.deepEqual(short!.adjustment, {
    step: 1,
    reason: "A rate cut landed this week.",
    driverIndexes: [0],
  });
  assert.equal(short!.confidence, "low");
  assert.equal(assembleCalls(valid, input)[0]!.adjustment, undefined);
});

check("key levels are measurements, formatted as money", () => {
  const levels = keyLevelsFrom(fallingState);
  assert.equal(levels[0]!.label, "Spot");
  assert.equal(levels[0]!.emphasis, true);
  assert.equal(levels.at(-1)!.value, "$4,400"); // the 52-week high
  for (const level of levels) assert.match(level.value, /^\$[\d,]+$/);
});

check("a driver's URL is always cited as a source", () => {
  const g = adjustedUp(driver());
  assert.ok(sourcesFrom(g).some((s) => s.url === "https://example.com/event"));
  assert.equal(new Set(sourcesFrom(g).map((s) => s.url)).size, sourcesFrom(g).length);
});

/* ----------------------- continuity + integrity -------------------------- */

console.log("\nContinuity and integrity");

/** The artifact and history entry the pipeline would publish for `g`. */
function publishedFrom(g: GeneratedOutlook): { report: OutlookReport; entry: HistoryEntry } {
  const report = outlookReportSchema.parse({
    contractVersion: CONTRACT_VERSION,
    date: today,
    updatedAt: `${today}T06:05:00.000Z`,
    origin: "generated",
    status: "published",
    summary: g.summary,
    spot: { price: input.spot.price, currency: "USD", asOf: input.spot.asOf },
    context: contextFrom(fallingState),
    scorecard: scorecardFrom(input),
    drivers: g.drivers,
    calls: assembleCalls(g, input),
    keyLevels: keyLevelsFrom(fallingState),
    analysisMarkdown: g.analysisMarkdown,
    sources: sourcesFrom(g),
  });
  return { report, entry: historyEntryFor(g, input, "test") };
}

check("the next run continues the standing call instead of starting over", () => {
  const { entry } = publishedFrom(valid);
  const next = briefFor("long", entry, iso(260));
  assert.equal(next.legacySignal, null);
  assert.equal(next.standing?.signal, "SELL");
  const { call, changed } = next.outcomes["0"];
  assert.equal(changed, false);
  assert.equal(call.since, today); // not the new run's date
  assert.deepEqual(call.levels, entry.calls.long.standing!.levels);
});

check("integrity: what the pipeline assembles is consistent", () => {
  for (const g of [valid, adjustedUp(driver())]) {
    const { report, entry } = publishedFrom(g);
    assert.deepEqual(artifactIssues(report, [preRules, entry]), []);
  }
});

check("integrity: a hand-edited signal fails", () => {
  const { report, entry } = publishedFrom(valid);
  report.calls[1]!.signal = "HOLD";
  assert.match(artifactIssues(report, [entry]).join(" | "), /signal is "HOLD" in the outlook but "SELL" in history/);
});

check("integrity: hand-edited confidence, level or since-date fails", () => {
  for (const edit of [
    // (the fixture's short-term call computes to "high")
    (r: OutlookReport) => (r.calls[0]!.confidence = "low"),
    (r: OutlookReport) => (r.calls[1]!.levels!.above = 9999),
    (r: OutlookReport) => (r.calls[0]!.since = "2026-01-01"),
    (r: OutlookReport) => (r.calls[1]!.baseline = "BUY"),
  ]) {
    const { report, entry } = publishedFrom(valid);
    edit(report);
    assert.notEqual(artifactIssues(report, [entry]).length, 0);
  }
});

check("integrity: editing the outlook AND its history together still fails", () => {
  const { report, entry } = publishedFrom(valid);
  report.calls[1]!.signal = "HOLD";
  entry.calls.long.signal = "HOLD";
  entry.calls.long.standing!.signal = "HOLD";
  // The scorecard still says SELL with no adjustment, and the levels are a SELL's.
  const issues = artifactIssues(report, [entry]).join(" | ");
  assert.match(issues, /is not the baseline SELL shifted by the recorded adjustment/);
  assert.match(issues, /levels do not fit a HOLD call/);
});

check("integrity: a rule-based outlook with no history entry fails; a pre-rules one is exempt", () => {
  const { report } = publishedFrom(valid);
  assert.match(artifactIssues(report, [preRules]).join(), /no entry for/);
  const legacy = { ...report, scorecard: undefined };
  assert.deepEqual(artifactIssues(legacy, []), []);
});

/* ---------------------- the artifact actually on disk --------------------- */

console.log("\nPublished artifact");

const onDisk = outlookReportSchema.parse(
  JSON.parse(await readFile(path.join(outlookDir(), "current.json"), "utf8")),
);
const diskIssues = artifactIssues(onDisk, await readHistory());
if (!onDisk.scorecard) {
  console.log(`  note current.json (${onDisk.date}) predates the scorecard — nothing to verify yet`);
}
check(`current.json (${onDisk.date}) is consistent with the rules and its history`, () => {
  // The issues go in the message: `check` prints its first line, and "values
  // are not deep-equal" would tell a reviewer nothing about what was edited.
  assert.ok(diskIssues.length === 0, diskIssues.join(" · "));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
