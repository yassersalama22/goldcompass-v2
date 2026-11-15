import type { MacroObservation } from "@/types/macro";

/**
 * Point-in-time statistics over a daily macro series.
 *
 * One implementation, two callers: the FRED provider uses it for today's
 * snapshot, and the signal logic uses it to ask the same question as of a past
 * date. If those two ever computed "30-day change" differently, the scorecard a
 * reader sees and the replay we calibrate against would quietly disagree.
 *
 * Pure — no I/O, no clock.
 */
export type MacroReading = {
  value: number;
  /** ISO date of the observation the reading comes from. */
  asOf: string;
  /** Absolute change vs the nearest observation on or before ~30 days earlier. */
  change30d: number | null;
  change90d: number | null;
  /** Percentile rank (0–100) of `value` within the trailing year. */
  pctile1y: number | null;
};

/** Fewer observations than this and a "one-year percentile" is not one. */
const MIN_OBSERVATIONS_FOR_PERCENTILE = 120;

export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The reading as of `asOf` (inclusive), or as of the latest observation when
 * `asOf` is omitted. `observations` must be sorted oldest-first, which is how
 * the provider returns them.
 */
export function readingAsOf(
  observations: MacroObservation[],
  asOf?: string,
): MacroReading | null {
  const known = asOf ? observations.filter((o) => o.date <= asOf) : observations;
  const latest = known.at(-1);
  if (!latest) return null;

  // Nearest observation on or before the cutoff — these series skip weekends
  // and holidays, so an exact-date lookup would miss more often than it hits.
  const changeOver = (days: number): number | null => {
    const cutoff = shiftIsoDate(latest.date, -days);
    const earlier = known.filter((o) => o.date <= cutoff).at(-1);
    return earlier ? latest.value - earlier.value : null;
  };

  const yearStart = shiftIsoDate(latest.date, -365);
  const year = known.filter((o) => o.date > yearStart);
  const pctile1y =
    year.length >= MIN_OBSERVATIONS_FOR_PERCENTILE
      ? (100 * year.filter((o) => o.value <= latest.value).length) / year.length
      : null;

  return {
    value: latest.value,
    asOf: latest.date,
    change30d: changeOver(30),
    change90d: changeOver(90),
    pctile1y,
  };
}
