import type { OutlookReport } from "@/types/outlook";
import type { HistoryEntry, Horizon, Signal } from "@/types/signal";

import { confidenceFor } from "./scorecard";

/**
 * Integrity of a published outlook — is every computed field still what the
 * rules computed?
 *
 * The outlook reaches production through a pull request a human merges, and a
 * JSON file in a PR can be edited. Changing `"signal": "SELL"` to `"HOLD"` is a
 * one-word edit that would publish a call the rules never made, under a
 * scorecard that says otherwise. This recomputes what can be recomputed and
 * cross-checks the artifact against its own history entry, so that edit fails
 * CI instead of shipping. The human gate remains: to overrule the rules, do
 * not merge.
 *
 * Pure. Returns human-readable problems; an empty list means consistent.
 */
const ORD: Record<Signal, number> = { SELL: -1, HOLD: 0, BUY: 1 };

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** `$3,862`. Restated here on purpose: this module must not import the generator. */
const money = (value: number): string => `$${Math.round(value).toLocaleString("en-US")}`;

export function artifactIssues(report: OutlookReport, history: HistoryEntry[]): string[] {
  // Outlooks published before the scorecard carry none of these fields.
  if (!report.scorecard) return [];

  const entry = history.find((e) => e.date === report.date);
  if (!entry) {
    return [
      `history.json has no entry for ${report.date} — the outlook and its history must be published together`,
    ];
  }

  const issues: string[] = [];

  for (const horizon of ["short", "long"] as const satisfies readonly Horizon[]) {
    const call = report.calls.find((c) => c.term === horizon);
    const standing = entry.calls[horizon].standing;
    const card = report.scorecard[horizon];
    const at = `${horizon}-term`;

    if (!call) {
      issues.push(`${at}: call missing`);
      continue;
    }
    if (!standing) {
      issues.push(`${at}: history entry has no standing call for a rule-based outlook`);
      continue;
    }

    const sum = card.factors.reduce((total, f) => total + f.reading, 0);
    if (sum !== card.score) {
      issues.push(`${at}: scorecard score ${card.score} is not the sum of its readings (${sum})`);
    }
    if (standing.score !== card.score) {
      issues.push(`${at}: history score ${standing.score} differs from scorecard score ${card.score}`);
    }

    // The artifact must say exactly what the pipeline recorded.
    const pairs: [string, unknown, unknown][] = [
      ["signal", call.signal, standing.signal],
      ["confidence", call.confidence, standing.confidence],
      ["since", call.since, standing.since],
      ["baseline", call.baseline, standing.baseline],
      ["levels", call.levels, standing.levels],
      ["previous", call.previous, standing.previous],
      ["change", call.change, standing.change],
      ["adjustment step", call.adjustment?.step ?? 0, standing.adjustmentStep],
    ];
    for (const [field, published, recorded] of pairs) {
      if (!same(published, recorded)) {
        issues.push(
          `${at}: ${field} is ${JSON.stringify(published)} in the outlook but ` +
            `${JSON.stringify(recorded)} in history — computed fields must not be edited by hand`,
        );
      }
    }

    // …and what it recorded must follow from the scorecard.
    const expected = confidenceFor(standing.signal, card, horizon, {
      adjusted: standing.adjustmentStep !== 0,
      pinned: standing.pinned,
    });
    if (standing.confidence !== expected) {
      issues.push(
        `${at}: confidence ${standing.confidence} does not follow from the scorecard (expected ${expected})`,
      );
    }
    if (
      !standing.pinned &&
      ORD[standing.signal] - ORD[standing.baseline] !== standing.adjustmentStep
    ) {
      issues.push(
        `${at}: ${standing.signal} is not the baseline ${standing.baseline} shifted by the ` +
          `recorded adjustment (${standing.adjustmentStep})`,
      );
    }

    const { below, above, setOn } = standing.levels;
    const shapeOk =
      (standing.signal === "BUY" && below !== undefined && above === undefined) ||
      (standing.signal === "SELL" && below === undefined && above !== undefined) ||
      (standing.signal === "HOLD" && below !== undefined && above !== undefined);
    if (!shapeOk) issues.push(`${at}: levels do not fit a ${standing.signal} call`);
    if (setOn !== standing.since) {
      issues.push(`${at}: levels were set on ${setOn} but the call stands since ${standing.since}`);
    }

    for (const level of [below, above]) {
      if (level !== undefined && !call.invalidation?.includes(money(level))) {
        issues.push(`${at}: the invalidation text does not state the level ${money(level)}`);
      }
    }
  }

  const spot = report.keyLevels.find((k) => k.emphasis);
  if (spot && spot.value !== money(report.spot.price)) {
    issues.push(
      `key levels: spot reads ${spot.value} but the outlook's spot is ${money(report.spot.price)}`,
    );
  }

  return issues;
}
