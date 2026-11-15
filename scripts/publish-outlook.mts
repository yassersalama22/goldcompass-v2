/**
 * Publish the reviewed draft: promote draft.json → current.json, and record
 * the call in history.json.
 *
 * This is the human-approval gate for the LOCAL flow — review draft.json, then
 * run this to make it live. (In CI the equivalent gate is merging the PR.)
 *   npm run outlook:publish
 *
 * History is written here, not at generation, so it only ever holds outlooks
 * that were published: tomorrow's run continues from the last call a reader
 * actually saw. In CI both files land in the same PR, so an unmerged draft
 * leaves no trace in either.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  outlookDir,
  pendingHistoryPath,
  readHistory,
  withEntry,
  writeHistory,
} from "@/server/outlook/signal";
import { outlookReportSchema } from "@/types/outlook";
import { historySchema } from "@/types/signal";

async function main() {
  const dir = outlookDir();
  const draftRaw = await readFile(path.join(dir, "draft.json"), "utf8");
  const draft = outlookReportSchema.parse(JSON.parse(draftRaw));

  // Read and validate the history entry BEFORE touching current.json: a draft
  // whose history cannot be recorded must not be published, or tomorrow's run
  // would continue from a call that was never the standing one.
  const pending = historySchema.parse(JSON.parse(await readFile(pendingHistoryPath(), "utf8")));
  if (!pending.some((entry) => entry.date === draft.date)) {
    throw new Error(
      `draft-history.json has no entry for ${draft.date} — regenerate the draft (npm run outlook:generate)`,
    );
  }

  const published = outlookReportSchema.parse({
    ...draft,
    status: "published" as const,
    updatedAt: new Date().toISOString(),
  });

  await writeFile(
    path.join(dir, "current.json"),
    JSON.stringify(published, null, 2) + "\n",
    "utf8",
  );
  console.log("[publish] current.json updated (status: published)");

  const history = pending.reduce(withEntry, await readHistory());
  await writeHistory(history);
  console.log(`[publish] history.json updated (${history.length} entries)`);
}

main().catch((err) => {
  console.error("[publish] FAILED:", err);
  process.exit(1);
});
