import { z } from "zod";

import type { MacroProvider } from "./provider";
import { readingAsOf, type MacroReading } from "./stats";
import type {
  MacroHistory,
  MacroIndicator,
  MacroIndicatorKey,
  MacroObservation,
  MacroSnapshot,
} from "@/types/macro";

/**
 * FRED (Federal Reserve Bank of St. Louis) macro provider.
 *
 * ── Why these series ────────────────────────────────────────────────────────
 * FRED's terms make clear that individual series may carry third-party
 * copyright ("Copyrighted: Citation Required" in the series notes), and that
 * using those beyond personal use requires the data owner's permission. Every
 * series below was checked and is `copyright-public-domain`:
 *
 *   DTWEXBGS  Nominal Broad U.S. Dollar Index          (Fed, public domain)
 *   DFII10    10-Year TIPS yield  = real 10y            (Treasury, public domain)
 *   DGS10     10-Year Treasury constant maturity yield  (Treasury, public domain)
 *
 * Deliberately NOT used: T10YIE (10-Year Breakeven Inflation Rate) IS flagged
 * "Copyrighted: Citation Required". We derive breakeven as DGS10 − DFII10 from
 * the two public-domain series instead, which is the same quantity.
 *
 * Also note we use the Fed's *broad* dollar index, not "DXY" — the ICE U.S.
 * Dollar Index is a proprietary index and is not ours to publish. The UI must
 * therefore never label this "DXY".
 *
 * Attribution ("Source: FRED, Federal Reserve Bank of St. Louis") is carried on
 * the snapshot and rendered under the panel.
 */
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const SERIES = {
  dollarIndex: "DTWEXBGS",
  real10y: "DFII10",
  nominal10y: "DGS10",
} as const;

export const FRED_ATTRIBUTION =
  "Source: FRED, Federal Reserve Bank of St. Louis (Board of Governors; U.S. Treasury)";

/** FRED returns values as strings, and "." means "no observation that day". */
const observationsSchema = z.object({
  observations: z.array(z.object({ date: z.string(), value: z.string() })),
});

const LABELS: Record<MacroIndicatorKey, string> = {
  dollarIndex: "US dollar (broad index)",
  real10y: "10-year real yield",
  nominal10y: "10-year Treasury yield",
  breakeven10y: "10-year inflation breakeven",
};

/**
 * A rise in each of these is, all else equal, a headwind for gold: a stronger
 * dollar makes gold costlier outside the US, and higher real yields raise the
 * opportunity cost of holding a non-yielding asset. Rising inflation
 * expectations cut the other way — that is gold's classic bid.
 */
const GOLD_EFFECT: Record<MacroIndicatorKey, "headwind" | "tailwind"> = {
  dollarIndex: "headwind",
  real10y: "headwind",
  nominal10y: "headwind",
  breakeven10y: "tailwind",
};

/**
 * Calendar days of history behind a snapshot. A year plus headroom: the
 * one-year percentile needs the full year, and the 90-day change needs to reach
 * back past weekends, holidays and "." gaps.
 */
export const DEFAULT_LOOKBACK_DAYS = 400;

/** One series, oldest first, with FRED's "." non-observations dropped. */
async function fetchSeries(
  seriesId: string,
  apiKey: string,
  lookbackDays: number,
): Promise<MacroObservation[]> {
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", start.toISOString().slice(0, 10));
  url.searchParams.set("sort_order", "asc");

  const res = await fetch(url, {
    // Daily series; one fetch per 6h is plenty and stays far inside any limit.
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`FRED ${seriesId} responded ${res.status}`);
  }

  const parsed = observationsSchema.parse(await res.json());
  const valid = parsed.observations
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => o.value === o.value && o.date); // drops "." → NaN

  if (valid.length === 0) {
    throw new Error(`FRED ${seriesId} returned no usable observations`);
  }
  return valid;
}

/** Guard against float noise like 1.9500000000000002 in derived values. */
const round4 = (n: number | null): number | null =>
  n == null ? null : Number(n.toFixed(4));

function toIndicator(
  key: MacroIndicatorKey,
  reading: Pick<MacroReading, "value" | "asOf" | "change30d" | "change90d" | "pctile1y">,
  unit: MacroIndicator["unit"],
): MacroIndicator {
  return {
    key,
    label: LABELS[key],
    value: Number(reading.value.toFixed(4)),
    unit,
    change30d: round4(reading.change30d),
    change90d: round4(reading.change90d),
    pctile1y: reading.pctile1y == null ? null : Math.round(reading.pctile1y),
    asOf: reading.asOf,
    goldEffect: GOLD_EFFECT[key],
  };
}

function requireReading(observations: MacroObservation[], seriesId: string): MacroReading {
  const reading = readingAsOf(observations);
  if (!reading) throw new Error(`FRED ${seriesId} returned no usable observations`);
  return reading;
}

/** Subtract two changes, or null if either leg is unknown. */
const diff = (a: number | null, b: number | null): number | null =>
  a == null || b == null ? null : a - b;

/**
 * Build the snapshot from raw series. Exported so the signal replay can derive
 * a snapshot from history it already fetched, instead of fetching twice.
 */
export function snapshotFromHistory(history: MacroHistory): MacroSnapshot {
  const dollar = requireReading(history.dollarIndex, SERIES.dollarIndex);
  const real = requireReading(history.real10y, SERIES.real10y);
  const nominal = requireReading(history.nominal10y, SERIES.nominal10y);

  const indicators: MacroIndicator[] = [
    toIndicator("dollarIndex", dollar, "index"),
    toIndicator("real10y", real, "percent"),
    toIndicator("nominal10y", nominal, "percent"),
  ];

  // Breakeven is derived rather than fetched — see the note above about
  // T10YIE being copyright-flagged. Only emit it when both legs share an
  // observation date, so we never subtract readings from different days.
  // Its change is the difference of the legs' changes, which is the same
  // quantity as (nominal − real) today minus (nominal − real) then.
  if (nominal.asOf === real.asOf) {
    indicators.push(
      toIndicator(
        "breakeven10y",
        {
          value: nominal.value - real.value,
          asOf: nominal.asOf,
          change30d: diff(nominal.change30d, real.change30d),
          change90d: diff(nominal.change90d, real.change90d),
          pctile1y: null,
        },
        "percent",
      ),
    );
  }

  return {
    indicators,
    source: FRED_ATTRIBUTION,
    fetchedAt: new Date().toISOString(),
  };
}

export function createFredProvider(apiKey: string): MacroProvider {
  async function getHistory(lookbackDays = DEFAULT_LOOKBACK_DAYS): Promise<MacroHistory> {
    const [dollarIndex, real10y, nominal10y] = await Promise.all([
      fetchSeries(SERIES.dollarIndex, apiKey, lookbackDays),
      fetchSeries(SERIES.real10y, apiKey, lookbackDays),
      fetchSeries(SERIES.nominal10y, apiKey, lookbackDays),
    ]);
    return { dollarIndex, real10y, nominal10y };
  }

  return {
    name: "FRED (St. Louis Fed)",
    getHistory,
    async getSnapshot(): Promise<MacroSnapshot> {
      return snapshotFromHistory(await getHistory());
    },
  };
}
