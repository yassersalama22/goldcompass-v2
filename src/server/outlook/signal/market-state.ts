import { readingAsOf, type MacroReading } from "@/server/macro/stats";
import type { MacroHistory } from "@/types/macro";
import type { PricePoint } from "@/types/price";

/**
 * Market state — the deterministic facts an outlook is written against.
 *
 * The first version of the pipeline handed the model a 30-day price summary and
 * nothing else. From inside that window a 25% drawdown from the year's high is
 * invisible, so the model filled the gap from memory and roughly a third of
 * published outlooks described a price far below the high as "record
 * territory". Everything here exists so that question is answered by
 * arithmetic, once, before any prose is written.
 *
 * Pure: no I/O, no clock, no `server-only` (it runs under tsx in the pipeline
 * scripts). Every figure is computed *as of* a date, which is what makes the
 * scorecard replayable over history instead of only assertable about today.
 */

export type DailyClose = {
  /** ISO date (UTC) of the reading. */
  date: string;
  /** Price at 00:00 UTC that day — the provider's daily reading. */
  close: number;
};

type Dated = { price: number; date: string };

export type MarketState = {
  /** Date of the latest daily close the state includes. */
  asOf: string;
  /** Live spot when supplied, otherwise the latest close. */
  price: number;
  /** How many daily closes were available. Short history nulls the long windows. */
  historyDays: number;

  /** Percent returns of `price` against the close N readings earlier. */
  ret20d: number | null;
  ret90d: number | null;
  ret365d: number | null;

  ma50: number | null;
  ma200: number | null;
  /** `price` relative to each average, percent. */
  pctVsMa50: number | null;
  pctVsMa200: number | null;
  /** 50-day average relative to the 200-day, percent. */
  ma50VsMa200Pct: number | null;

  /** Highest / lowest reading in the available history (≤ one year). */
  high52w: Dated;
  low52w: Dated;
  /** `price` relative to `high52w`, percent — zero or negative. */
  drawdownPct: number;

  /** Closing extremes over the windows the frozen levels are derived from. */
  low20d: number | null;
  high20d: number | null;
  low90d: number | null;
  high90d: number | null;

  /** Annualised volatility of the last 20 daily moves, percent. */
  vol20dPct: number | null;

  /** Null when no macro history was supplied or the series has no reading yet. */
  macro: {
    dollarIndex: MacroReading | null;
    real10y: MacroReading | null;
    nominal10y: MacroReading | null;
  } | null;
};

const DAY_MS = 86_400_000;

/**
 * Reduce raw provider points to one reading per UTC day.
 *
 * The provider returns a midnight point per day plus a trailing "right now"
 * point. That last point is not a daily close — treating it as one would let a
 * mid-session wobble breach a level defined on closes — so only midnight
 * readings are kept. The live price reaches the state separately, as `spot`.
 */
export function toDailyCloses(points: PricePoint[]): DailyClose[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    if (point.t % DAY_MS !== 0) continue;
    byDate.set(new Date(point.t).toISOString().slice(0, 10), point.price);
  }
  return [...byDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

const pct = (value: number, base: number): number => (value / base - 1) * 100;

export function buildMarketState(input: {
  /** Oldest first. Readings after `asOf` are ignored. */
  closes: DailyClose[];
  macro: MacroHistory | null;
  /** Compute the state as of this date. Defaults to the latest close. */
  asOf?: string;
  /** Live price, when the state is for "now" rather than a past close. */
  spot?: number;
}): MarketState {
  const closes = input.asOf
    ? input.closes.filter((c) => c.date <= input.asOf!)
    : input.closes;
  const last = closes.at(-1);
  if (!last) throw new Error("buildMarketState: no daily closes on or before asOf");

  const asOf = last.date;
  const price = input.spot ?? last.close;
  const n = closes.length;

  /** `price` against the close `days` readings before the latest one. */
  const ret = (days: number): number | null =>
    n > days ? pct(price, closes[n - 1 - days]!.close) : null;

  const tail = (count: number): number[] | null =>
    n >= count ? closes.slice(n - count).map((c) => c.close) : null;

  const ma = (count: number): number | null => {
    const window = tail(count);
    return window ? mean(window) : null;
  };

  const ma50 = ma(50);
  const ma200 = ma(200);

  // The live price can itself be the high or the low of the year.
  const readings: Dated[] = [
    ...closes.map((c) => ({ price: c.close, date: c.date })),
    ...(input.spot === undefined ? [] : [{ price: input.spot, date: asOf }]),
  ];
  const high52w = readings.reduce((a, b) => (b.price > a.price ? b : a));
  const low52w = readings.reduce((a, b) => (b.price < a.price ? b : a));

  const window20 = tail(20);
  const window90 = tail(90);

  let vol20dPct: number | null = null;
  const window21 = tail(21);
  if (window21) {
    const moves = window21.slice(1).map((v, i) => Math.log(v / window21[i]!));
    const avg = mean(moves);
    const variance = mean(moves.map((m) => (m - avg) ** 2));
    // The proxy trades every calendar day, so annualise over 365, not 252.
    vol20dPct = Math.sqrt(variance) * Math.sqrt(365) * 100;
  }

  return {
    asOf,
    price,
    historyDays: n,
    ret20d: ret(20),
    ret90d: ret(90),
    ret365d: ret(364),
    ma50,
    ma200,
    pctVsMa50: ma50 == null ? null : pct(price, ma50),
    pctVsMa200: ma200 == null ? null : pct(price, ma200),
    ma50VsMa200Pct: ma50 == null || ma200 == null ? null : pct(ma50, ma200),
    high52w,
    low52w,
    drawdownPct: pct(price, high52w.price),
    low20d: window20 ? Math.min(...window20) : null,
    high20d: window20 ? Math.max(...window20) : null,
    low90d: window90 ? Math.min(...window90) : null,
    high90d: window90 ? Math.max(...window90) : null,
    vol20dPct,
    macro: input.macro
      ? {
          dollarIndex: readingAsOf(input.macro.dollarIndex, asOf),
          real10y: readingAsOf(input.macro.real10y, asOf),
          nominal10y: readingAsOf(input.macro.nominal10y, asOf),
        }
      : null,
  };
}
