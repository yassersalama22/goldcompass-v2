/**
 * Generate a gold-market article draft (Aureus-style pipeline).
 *
 *   1. Fetch current gold price (CoinGecko) for grounding.
 *   2. Generate the article via the configured provider (Claude, or the mock
 *      when ANTHROPIC_API_KEY is unset / ARTICLE_GENERATOR=mock).
 *   3. Sanitize + assemble a full Article (origin: generated, status: draft).
 *   4. Validate against the contract and write src/content/articles/<slug>.json.
 *
 * Does NOT publish. Run `publish-article` (or merge the PR) to go live.
 * Optional steer: ARTICLE_TOPIC="China central-bank gold buying" npm run articles:generate
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { coinGeckoProvider } from "@/server/price/coingecko";
import {
  getArticleGenerator,
  sanitizeGeneratedArticle,
  ARTICLE_PROMPT_VERSION,
} from "@/server/articles/generator";
import { ARTICLE_CONTRACT_VERSION, articleSchema, type Article } from "@/types/article";

function kebab(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "article"
  );
}

async function getSpot() {
  try {
    const q = await coinGeckoProvider.getQuote();
    return { price: q.price, changePct24h: q.changePct24h, asOf: q.asOf };
  } catch (err) {
    console.warn("[article] price unavailable:", (err as Error).message);
    return null;
  }
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const topic = process.env.ARTICLE_TOPIC || undefined;

  const spot = await getSpot();
  const generator = await getArticleGenerator();
  console.log(`[article] provider=${generator.name} prompt=${ARTICLE_PROMPT_VERSION} date=${date}`);

  const generated = sanitizeGeneratedArticle(await generator.generate({ date, spot, topic }));

  const slug = `${date}-${kebab(generated.title)}`;
  const article: Article = {
    contractVersion: ARTICLE_CONTRACT_VERSION,
    slug,
    title: generated.title,
    description: generated.description,
    category: generated.category,
    tags: generated.tags,
    date,
    updatedAt: now.toISOString(),
    origin: "generated",
    status: "draft",
    bodyMarkdown: generated.bodyMarkdown,
    sources: generated.sources,
  };

  const validated = articleSchema.parse(article);

  const dir = path.join(process.cwd(), "src", "content", "articles");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${slug}.json`);
  await writeFile(out, JSON.stringify(validated, null, 2) + "\n", "utf8");

  console.log(`[article] wrote ${out}`);
  console.log(`[article] title="${validated.title}" category=${validated.category} sources=${validated.sources.length}`);
}

main().catch((err) => {
  console.error("[article] FAILED:", err);
  process.exit(1);
});
