/**
 * Publish reviewed article drafts: flip status draft → published.
 *
 * Human-approval gate for the LOCAL flow — review the draft file(s), then run
 * this. (In CI the gate is merging the PR.) Promotes ALL draft articles.
 *   npm run articles:publish
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { articleSchema } from "@/types/article";

async function main() {
  const dir = path.join(process.cwd(), "src", "content", "articles");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));

  let published = 0;
  for (const file of files) {
    const full = path.join(dir, file);
    const article = articleSchema.parse(JSON.parse(await readFile(full, "utf8")));
    if (article.status !== "draft") continue;

    const next = articleSchema.parse({
      ...article,
      status: "published" as const,
      updatedAt: new Date().toISOString(),
    });
    await writeFile(full, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`[article] published ${file} — "${next.title}"`);
    published++;
  }

  console.log(published ? `[article] ${published} published.` : "[article] no drafts to publish.");
}

main().catch((err) => {
  console.error("[article] FAILED:", err);
  process.exit(1);
});
