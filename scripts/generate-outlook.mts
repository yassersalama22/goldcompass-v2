/**
 * Generate the gold outlook draft (Aureus v3 pipeline, §12.1).
 *
 *   1. Fetch ground truth: live quote, one year of daily closes, macro history.
 *   2. Compute the market state and, per horizon, the scorecard, the standing
 *      call's fate, and the call each permitted adjustment would publish.
 *   3. Ask the generator for prose, dated events and an adjustment request
 *      (Claude, or the mock when ANTHROPIC_API_KEY is unset / OUTLOOK_GENERATOR=mock).
 *   4. Validate the response against today's brief, then assemble the report:
 *      prose from the model; signal, confidence, levels, key levels, scorecard
 *      and context from the rules and the data.
 *   5. Write draft.json, the pending history entry, and the review summary.
 *
 * Does NOT publish. Run `publish-outlook` (or merge the PR) to go live.
 *   npm run outlook:generate
 *
 * Any failure exits non-zero and leaves the published artifact untouched
 * (§12: on failure, keep the previous outlook).
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchMacroHistory } from "@/server/macro";
import { coinGeckoProvider } from "@/server/price/coingecko";
import {
  PROMPT_VERSION,
  advisoriesFor,
  assembleCalls,
  buildBrief,
  buildGeneratedSchema,
  contextFrom,
  getOutlookGenerator,
  historyEntryFor,
  keyLevelsFrom,
  sanitizeGenerated,
  scorecardFrom,
  sourcesFrom,
  type GenerationInput,
} from "@/server/outlook/generator";
import { buildReviewSummary } from "@/server/outlook/generator/review";
import {
  RULES_VERSION,
  buildMarketState,
  entryBefore,
  outlookDir,
  pendingHistoryPath,
  readHistory,
  toDailyCloses,
  withEntry,
} from "@/server/outlook/signal";
import {
  CONTRACT_VERSION,
  outlookReportSchema,
  shortTermCall,
  longTermCall,
  type OutlookReport,
} from "@/types/outlook";
import type { HistoryEntry } from "@/types/signal";

/**
 * Below this many daily closes the long-term scorecard cannot measure a
 * 200-day average, and a call built on unmeasured factors is not one we should
 * publish. Fail the run instead; yesterday's outlook stays live.
 */
const MIN_CLOSES = 200;
/** The newest close may be at most this many days old. */
const MAX_CLOSE_AGE_DAYS = 2;

const DAY_MS = 86_400_000;

/**
 * Retry a price fetch. The free price API rate-limits by IP and answers 429
 * for a minute or so. The old pipeline shrugged off a failed series fetch, but
 * the scorecard cannot be computed without one, so a single 429 would now cost
 * the day's outlook. Three attempts, spaced past the limiter's window.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const delaysMs = [20_000, 60_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const delay = delaysMs[attempt];
      if (delay === undefined) throw err;
      console.warn(
        `[generate] ${label} failed (${(err as Error).message}); retrying in ${delay / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * History as the next run should see it.
 *
 * `history.json` is appended at publish time, so normally its last entry IS
 * the published outlook. The exception is a published artifact that predates
 * the history file's last entry being written — outlooks merged on `main`
 * after the backfill ran. The published artifact is the truth about what a
 * reader last saw, so it is folded in here rather than trusting a stale file.
 */
async function historyWithPublished(today: string): Promise<HistoryEntry[]> {
  const history = await readHistory();

  let published: OutlookReport;
  try {
    published = outlookReportSchema.parse(
      JSON.parse(await readFile(path.join(outlookDir(), "current.json"), "utf8")),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return history;
    throw err;
  }

  const known = history.some((e) => e.date === published.date);
  const short = shortTermCall(published);
  const long = longTermCall(published);
  // A rule-based artifact always has a history entry (publish writes both), so
  // only a pre-rules one can be missing — and only its signals are needed.
  if (known || published.date >= today || published.scorecard || !short || !long) {
    return history;
  }
  return withEntry(history, {
    date: published.date,
    spot: published.spot.price,
    legacy: true,
    calls: {
      short: { signal: short.signal, confidence: short.confidence },
      long: { signal: long.signal, confidence: long.confidence },
    },
  });
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const quote = await withRetry("quote", () => coinGeckoProvider.getQuote());
  const closes = toDailyCloses(
    await withRetry("price history", () => coinGeckoProvider.getDailyHistory(365)),
  );
  const newest = closes.at(-1);
  if (closes.length < MIN_CLOSES || !newest) {
    throw new Error(`price history too short: ${closes.length} daily closes (need ${MIN_CLOSES})`);
  }
  const ageDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${newest.date}T00:00:00Z`)) / DAY_MS;
  if (ageDays > MAX_CLOSE_AGE_DAYS) {
    throw new Error(`price history is stale: newest daily close is ${newest.date}`);
  }

  const { history: macroHistory, snapshot: macro } = await fetchMacroHistory();
  const state = buildMarketState({ closes, macro: macroHistory, spot: quote.price });

  const history = await historyWithPublished(date);
  const previousEntry = entryBefore(history, date);
  const briefs = {
    short: buildBrief({ horizon: "short", state, closes, macro: macroHistory, previousEntry, today: date }),
    long: buildBrief({ horizon: "long", state, closes, macro: macroHistory, previousEntry, today: date }),
  };

  const input: GenerationInput = {
    date,
    spot: { price: quote.price, changePct24h: quote.changePct24h, asOf: quote.asOf },
    state,
    macro: macro.data,
    briefs,
  };

  const generator = await getOutlookGenerator();
  console.log(
    `[generate] provider=${generator.name} prompt=${PROMPT_VERSION} rules=${RULES_VERSION} date=${date} ` +
      `closes=${closes.length} macro=${macro.data ? `${macro.data.indicators.length} indicators` : "none"}`,
  );
  for (const h of ["short", "long"] as const) {
    const b = briefs[h];
    console.log(
      `[generate] ${h}: score=${b.scorecard.score} baseline=${b.outcomes["0"].call.baseline} ` +
        `standing=${b.standing?.signal ?? (b.legacySignal ? `${b.legacySignal} (pre-rules)` : "none")} ` +
        `breach=${b.breach ? `${b.breach.side} ${b.breach.level} on ${b.breach.date}` : "no"} ` +
        `→ ${b.outcomes["0"].call.signal} without adjustment`,
    );
  }

  // Validated here as well as inside the Claude generator, so the mock — and
  // any future provider — passes through exactly the same rules.
  const generated = sanitizeGenerated(
    buildGeneratedSchema(input).parse(await generator.generate(input)),
  );

  const report: OutlookReport = {
    contractVersion: CONTRACT_VERSION,
    date,
    updatedAt: now.toISOString(),
    origin: "generated",
    status: "draft",
    summary: generated.summary,
    spot: {
      price: quote.price,
      currency: "USD",
      asOf: quote.asOf,
      changePct: quote.changePct24h ?? undefined,
    },
    // Snapshots, not live reads: the page must show what the call was set from.
    ...(macro.data ? { macro: macro.data } : {}),
    context: contextFrom(state),
    scorecard: scorecardFrom(input),
    drivers: generated.drivers,
    calls: assembleCalls(generated, input),
    keyLevels: keyLevelsFrom(state),
    analysisMarkdown: generated.analysisMarkdown,
    sources: sourcesFrom(generated),
  };

  const validated = outlookReportSchema.parse(report);

  const dir = outlookDir();
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "draft.json");
  await writeFile(out, JSON.stringify(validated, null, 2) + "\n", "utf8");

  // What publishing this draft adds to history: today's entry, plus the
  // published pre-rules entry if the history file had not recorded it yet.
  const pending = [
    ...(previousEntry && !(await readHistory()).some((e) => e.date === previousEntry.date)
      ? [previousEntry]
      : []),
    historyEntryFor(generated, input, PROMPT_VERSION),
  ];
  await writeFile(pendingHistoryPath(), JSON.stringify(pending, null, 2) + "\n", "utf8");

  // Whatever the model's one revision pass did not resolve goes to the reviewer.
  const advisories = advisoriesFor(generated, input);
  for (const note of advisories) console.warn(`[generate] wording flag — ${note}`);

  const summary = buildReviewSummary({
    report: validated,
    briefs,
    previousEntry,
    generator: generator.name,
    promptVersion: PROMPT_VERSION,
    advisories,
  });
  const reviewPath = process.env.OUTLOOK_REVIEW_PATH ?? path.join(process.cwd(), "outlook-review.md");
  await writeFile(reviewPath, summary, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }

  console.log(`[generate] wrote ${out}`);
  console.log(`[generate] wrote ${reviewPath}`);
  for (const call of validated.calls) {
    console.log(
      `[generate] ${call.term}=${call.signal}/${call.confidence} since ${call.since}` +
        (call.adjustment ? ` (adjusted ${call.adjustment.step > 0 ? "+1" : "-1"})` : "") +
        (call.change?.date === date ? ` — changed today: ${call.change.reason}` : ""),
    );
  }
}

main().catch((err) => {
  console.error("[generate] FAILED:", err);
  process.exit(1);
});
