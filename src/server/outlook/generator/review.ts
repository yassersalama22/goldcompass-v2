import { messages } from "@/i18n/messages";
import type { OutlookCall, OutlookReport } from "@/types/outlook";
import type { FactorKey, HistoryEntry, Horizon, Levels, Scorecard } from "@/types/signal";

import type { HorizonBrief } from "./brief";
import { levelText } from "./schema";

/**
 * The review summary — the body of the daily pull request.
 *
 * The old PR was a 9 KB prose diff with a checklist. Ninety-seven of those were
 * merged while the calls never moved and a third of them called a price 25%
 * below its high a record: nothing in the PR said "this is the same call as
 * yesterday", or "the level you published last week was broken". This puts the
 * decision, and the evidence for it, above the fold.
 *
 * Pure: it formats what the pipeline already computed.
 */

/** The page's own labels — the reviewer sees the factors as readers will. */
const FACTOR_LABELS: Record<FactorKey, string> = messages("en").outlook.scorecard.factors;

const REASONS: Record<string, string> = {
  invalidation_hit: "a frozen level was broken",
  evidence_shift: "the scorecard baseline moved",
  event_adjustment: "adjusted for a cited event",
  adjustment_ended: "a previous event adjustment no longer applies",
  methodology_change: "first call set by the rules (was chosen freely before)",
};

const NAMES: Record<Horizon, string> = { short: "Short-term", long: "Long-term" };

/** Signed, except that zero is just "0" — "+0" reads as a small positive. */
const signed = (n: number, digits = 2): string => {
  const text = n.toFixed(digits);
  return Number(text) === 0 ? text.replace("-", "") : `${n > 0 ? "+" : ""}${text}`;
};

function levelsLine(levels: Levels): string {
  const parts = [
    levels.below !== undefined ? `below ${levelText(levels.below)}` : null,
    levels.above !== undefined ? `above ${levelText(levels.above)}` : null,
  ].filter(Boolean);
  return `a daily close ${parts.join(" or ")} (set ${levels.setOn})`;
}

function scorecardTable(card: Scorecard): string[] {
  return [
    "| Factor | Measured | Reading |",
    "|---|---|---|",
    ...card.factors.map((f) => {
      const value =
        f.value == null ? "not available" : `${signed(f.value)}${f.unit === "pp" ? " pp" : "%"}`;
      return `| ${FACTOR_LABELS[f.key]} | ${value} | ${f.value == null ? "—" : signed(f.reading, 0)} |`;
    }),
  ];
}

export function buildReviewSummary(args: {
  report: OutlookReport;
  briefs: Record<Horizon, HorizonBrief>;
  previousEntry: HistoryEntry | null;
  generator: string;
  promptVersion: string;
  /**
   * Prose the automatic checks could not clear (see `advisoriesFor`). These
   * are judgements, so they are shown to the reviewer rather than enforced.
   */
  advisories?: string[];
}): string {
  const { report, briefs, previousEntry } = args;
  const advisories = args.advisories ?? [];
  const callFor = (h: Horizon): OutlookCall => report.calls.find((c) => c.term === h)!;
  const horizons = ["short", "long"] as const;

  const changed = horizons.filter(
    (h) => previousEntry && previousEntry.calls[h].signal !== callFor(h).signal,
  );

  const lines: string[] = [
    `Automated daily gold outlook — **${report.date}**, spot ${levelText(report.spot.price)}.`,
    "",
    !previousEntry
      ? "## First outlook on record"
      : changed.length === 0
        ? "## No change — both calls stand"
        : `## ⚠ ${changed.map((h) => NAMES[h]).join(" and ")} call changed`,
    "",
    `| | Last published${previousEntry ? ` (${previousEntry.date})` : ""} | Today | Standing since | Why |`,
    "|---|---|---|---|---|",
  ];

  for (const h of horizons) {
    const call = callFor(h);
    const before = previousEntry?.calls[h];
    const isChange = before !== undefined && before.signal !== call.signal;
    lines.push(
      `| ${NAMES[h]} | ${before ? `${before.signal} (${before.confidence})` : "—"} | ` +
        `${isChange ? `**${call.signal}**` : call.signal} (${call.confidence}) | ${call.since ?? "—"} | ` +
        `${isChange && call.change ? (REASONS[call.change.reason] ?? call.change.reason) : "unchanged"} |`,
    );
  }

  if (advisories.length > 0) {
    lines.push(
      "",
      `### ⚠ ${advisories.length} wording flag${advisories.length === 1 ? "" : "s"} to check`,
      "",
      "Automatic checks could not clear these. They are pattern matches, so some are false alarms — read each one:",
      "",
      ...advisories.map((note) => `- ${note}`),
    );
  }

  if (report.context) {
    const c = report.context;
    lines.push(
      "",
      `Price context: ${Math.abs(c.drawdownPct).toFixed(1)}% below the 52-week high of ` +
        `${levelText(c.high52w.price)} (${c.high52w.date})` +
        (c.ma200 == null ? "." : `; 200-day average ${levelText(c.ma200)}.`),
    );
  }

  for (const h of horizons) {
    const call = callFor(h);
    const brief = briefs[h];
    lines.push(
      "",
      `### ${NAMES[h]} — score ${signed(brief.scorecard.score, 0)}, baseline ${call.baseline ?? "—"}`,
      "",
      ...scorecardTable(brief.scorecard),
      "",
    );
    if (brief.breach) {
      lines.push(
        `- **Level broken:** the close of ${levelText(brief.breach.close)} on ${brief.breach.date} went ` +
          `${brief.breach.side} ${levelText(brief.breach.level)}. The call was required to move.`,
      );
    }
    if (call.levels) lines.push(`- **Would change on:** ${levelsLine(call.levels)}.`);
    if (call.adjustment) {
      const cited = call.adjustment.driverIndexes
        .map((i) => report.drivers?.[i])
        .filter((d) => d !== undefined)
        .map((d) => `[${d.title}](${d.url}) (${d.eventDate})`);
      lines.push(
        `- **⚠ Adjusted ${call.adjustment.step > 0 ? "+1" : "−1"} from the baseline** — ${call.adjustment.reason}`,
        `  - Cites: ${cited.join("; ")}`,
        "  - Check that this is a genuine, recent event and not a standing narrative.",
      );
    } else {
      lines.push("- **Adjustment:** none — the call is the scorecard's.");
    }
  }

  if (report.drivers?.length) {
    lines.push("", "### Events the model found", "");
    for (const d of report.drivers) {
      lines.push(`- ${d.eventDate} · ${d.direction} · ${d.horizon} — [${d.title}](${d.url})`);
    }
  }

  lines.push(
    "",
    "### Review before merging",
    "",
    "- [ ] The events above are real, correctly dated, and say what the draft claims",
    "- [ ] Any adjustment rests on a genuine recent event",
    "- [ ] The analysis reads well and is consistent with the calls",
    "- [ ] Translated artifacts under `src/content/outlook/<locale>/` read correctly (numbers, structure and terminology are checked by `i18n:check`)",
    "",
    "Signals, confidence, levels and key levels are **computed, not written** — `check:signal` fails this PR if any were edited by hand. To overrule the rules, don't merge.",
    "",
    `<sub>Rules ${report.scorecard?.rulesVersion ?? "—"} · prompt ${args.promptVersion} · ${args.generator}</sub>`,
  );

  return lines.join("\n") + "\n";
}
