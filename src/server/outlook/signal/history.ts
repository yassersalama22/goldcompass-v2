import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { historySchema, type HistoryEntry } from "@/types/signal";

/**
 * Call history — the memory the first pipeline did not have.
 *
 * `history.json` sits beside `current.json` and is committed with it
 * (Git-as-CMS), so it only ever contains outlooks that were actually published:
 * the pipeline appends to it at publish time, in the same PR a human reviews.
 * A draft that is never merged leaves no trace, and the next run continues from
 * the last call a reader actually saw.
 *
 * Not `server-only`: the pipeline scripts run under tsx. Nothing in `src/app`
 * reads this file — the page renders the reader-facing subset stored on the
 * artifact itself.
 */

/**
 * Where the outlook artifacts live. Overridable so the pipeline can be run
 * end to end against a scratch copy — exercising publish, history and a
 * multi-day sequence — without touching the published artifact.
 */
export function outlookDir(): string {
  return (
    process.env.OUTLOOK_CONTENT_DIR ??
    path.join(process.cwd(), "src", "content", "outlook")
  );
}

export const historyPath = (): string => path.join(outlookDir(), "history.json");
/** The entry a draft will add if it is published. Gitignored, like `draft.json`. */
export const pendingHistoryPath = (): string => path.join(outlookDir(), "draft-history.json");

/** Oldest first. A missing file is an empty history, not an error. */
export async function readHistory(): Promise<HistoryEntry[]> {
  let raw: string;
  try {
    raw = await readFile(historyPath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return historySchema.parse(JSON.parse(raw));
}

/**
 * Add an entry, replacing any existing one for the same date — a rerun on the
 * same day revises that day's entry rather than recording two calls for it.
 */
export function withEntry(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history.filter((e) => e.date !== entry.date), entry].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * One entry per line: the file grows by a line a day, and a reviewer should
 * see exactly that line in the PR diff rather than a re-indented document.
 */
export async function writeHistory(history: HistoryEntry[]): Promise<void> {
  const validated = historySchema.parse(history);
  const body = validated.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n");
  await writeFile(historyPath(), `[\n${body}\n]\n`, "utf8");
}

/** The most recent entry strictly before `date` — what today's run continues. */
export function entryBefore(history: HistoryEntry[], date: string): HistoryEntry | null {
  return history.filter((e) => e.date < date).at(-1) ?? null;
}
