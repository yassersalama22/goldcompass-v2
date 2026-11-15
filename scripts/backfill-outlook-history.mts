/**
 * Rebuild `history.json` from git — `npm run outlook:backfill`.
 *
 * Every outlook published before the scorecard existed lives only in the git
 * history of `current.json`. This walks that history and records one entry per
 * published date, flagged `legacy` (the signal was chosen by the model, not
 * computed). Two things need them: the first rule-based call has to be able to
 * say what it replaced, and a track record can only be honest if it includes
 * the period before the rules.
 *
 * One-off, local only: it needs full git history (CI checks out a single
 * commit) and it only ever ADDS legacy entries — rule-based entries already in
 * the file are kept as they are. Safe to rerun; the pipeline also folds in the
 * currently published outlook at generation time, so a stale backfill is
 * harmless.
 */
import { execFileSync } from "node:child_process";

import { readHistory, withEntry, writeHistory } from "@/server/outlook/signal";
import { longTermCall, outlookReportSchema, shortTermCall } from "@/types/outlook";
import type { HistoryEntry } from "@/types/signal";

const ARTIFACT = "src/content/outlook/current.json";

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

async function main() {
  // Oldest first, so a later commit for the same date overwrites an earlier one.
  const commits = git("log", "--reverse", "--format=%H", "--", ARTIFACT).trim().split("\n").filter(Boolean);

  const existing = await readHistory();
  const ruleBased = new Set(existing.filter((e) => !e.legacy).map((e) => e.date));

  let history: HistoryEntry[] = existing;
  let added = 0;
  let skipped = 0;

  for (const sha of commits) {
    let report;
    try {
      report = outlookReportSchema.parse(JSON.parse(git("show", `${sha}:${ARTIFACT}`)));
    } catch {
      skipped++; // an artifact from before the current contract shape
      continue;
    }
    const short = shortTermCall(report);
    const long = longTermCall(report);
    if (report.status !== "published" || !short || !long) {
      skipped++;
      continue;
    }
    // Never replace a rule-based entry with a signals-only one.
    if (report.scorecard || ruleBased.has(report.date)) continue;

    history = withEntry(history, {
      date: report.date,
      spot: report.spot.price,
      legacy: true,
      calls: {
        short: { signal: short.signal, confidence: short.confidence },
        long: { signal: long.signal, confidence: long.confidence },
      },
    });
    added++;
  }

  await writeHistory(history);
  const legacy = history.filter((e) => e.legacy);
  console.log(
    `[backfill] ${commits.length} commits read, ${added} applied, ${skipped} skipped → ` +
      `${history.length} entries (${legacy.length} legacy), ${history[0]?.date} → ${history.at(-1)?.date}`,
  );
}

main().catch((err) => {
  console.error("[backfill] FAILED:", err);
  process.exit(1);
});
