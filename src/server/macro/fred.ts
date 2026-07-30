import { z } from "zod";

import type { MacroProvider } from "./provider";
import type { MacroIndicator, MacroIndicatorKey, MacroSnapshot } from "@/types/macro";

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

type Reading = { value: number; asOf: string; value30dAgo: number | null };

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
 * Fetch ~60 calendar days and keep the valid observations. 60 gives comfortable
 * headroom over a 30-day lookback once weekends, holidays, and "." gaps are
 * dropped.
 */
async function fetchSeries(seriesId: string, apiKey: string): Promise<Reading> {
  const start = new Date();
  start.setDate(start.getDate() - 60);

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

  const latest = valid.at(-1);
  if (!latest) throw new Error(`FRED ${seriesId} returned no usable observations`);

  // Nearest observation on or before (latest − 30 days).
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const earlier = valid.filter((o) => o.date <= cutoffStr).at(-1);

  return {
    value: latest.value,
    asOf: latest.date,
    value30dAgo: earlier?.value ?? null,
  };
}

function toIndicator(
  key: MacroIndicatorKey,
  value: number,
  asOf: string,
  change30d: number | null,
  unit: MacroIndicator["unit"],
): MacroIndicator {
  return {
    key,
    label: LABELS[key],
    // Guard against float noise like 1.9500000000000002 in derived values.
    value: Number(value.toFixed(4)),
    unit,
    change30d: change30d == null ? null : Number(change30d.toFixed(4)),
    asOf,
    goldEffect: GOLD_EFFECT[key],
  };
}

export function createFredProvider(apiKey: string): MacroProvider {
  return {
    name: "FRED (St. Louis Fed)",

    async getSnapshot(): Promise<MacroSnapshot> {
      const [dollar, real, nominal] = await Promise.all([
        fetchSeries(SERIES.dollarIndex, apiKey),
        fetchSeries(SERIES.real10y, apiKey),
        fetchSeries(SERIES.nominal10y, apiKey),
      ]);

      const indicators: MacroIndicator[] = [
        toIndicator(
          "dollarIndex",
          dollar.value,
          dollar.asOf,
          dollar.value30dAgo == null ? null : dollar.value - dollar.value30dAgo,
          "index",
        ),
        toIndicator(
          "real10y",
          real.value,
          real.asOf,
          real.value30dAgo == null ? null : real.value - real.value30dAgo,
          "percent",
        ),
        toIndicator(
          "nominal10y",
          nominal.value,
          nominal.asOf,
          nominal.value30dAgo == null ? null : nominal.value - nominal.value30dAgo,
          "percent",
        ),
      ];

      // Breakeven is derived rather than fetched — see the note above about
      // T10YIE being copyright-flagged. Only emit it when both legs share an
      // observation date, so we never subtract readings from different days.
      if (nominal.asOf === real.asOf) {
        const breakeven = nominal.value - real.value;
        const change =
          nominal.value30dAgo != null && real.value30dAgo != null
            ? breakeven - (nominal.value30dAgo - real.value30dAgo)
            : null;
        indicators.push(
          toIndicator("breakeven10y", breakeven, nominal.asOf, change, "percent"),
        );
      }

      return {
        indicators,
        source: FRED_ATTRIBUTION,
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
