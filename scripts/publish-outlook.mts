/**
 * Publish the reviewed draft: promote draft.json → current.json.
 *
 * This is the human-approval gate for the LOCAL flow — review draft.json, then
 * run this to make it live. (In CI the equivalent gate is merging the PR.)
 *   npm run outlook:publish
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { outlookReportSchema } from "@/types/outlook";

async function main() {
  const dir = path.join(process.cwd(), "src", "content", "outlook");
  const draftRaw = await readFile(path.join(dir, "draft.json"), "utf8");
  const draft = outlookReportSchema.parse(JSON.parse(draftRaw));

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
}

main().catch((err) => {
  console.error("[publish] FAILED:", err);
  process.exit(1);
});
