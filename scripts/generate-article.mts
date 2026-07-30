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
import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { RESERVED_INSIGHT_SLUGS } from "@/config/insight-kinds";
import { coinGeckoProvider } from "@/server/price/coingecko";
import {
  getArticleGenerator,
  sanitizeGeneratedArticle,
  ARTICLE_PROMPT_VERSION,
} from "@/server/articles/generator";
import { ARTICLE_CONTRACT_VERSION, articleSchema, type Article } from "@/types/article";

/**
 * Slug length cap. Generous on purpose: the slug no longer carries a date
 * prefix, so almost every real title fits whole and the truncation below is
 * only a safety net for outliers.
 */
const MAX_SLUG_LENGTH = 80;

function kebab(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= MAX_SLUG_LENGTH) return base || "article";

  // Truncate on a word boundary. Slicing blind used to emit half a word
  // (…hawkish-hold-means-for-go), which reads as broken in search results.
  // Take one char past the cap: if it is the separator, the slug already ends
  // on a complete word; otherwise drop back to the last separator.
  const cut = base.slice(0, MAX_SLUG_LENGTH + 1);
  const lastSeparator = cut.lastIndexOf("-");
  const trimmed =
    lastSeparator > 0 ? cut.slice(0, lastSeparator) : base.slice(0, MAX_SLUG_LENGTH);
  return trimmed.replace(/-+$/g, "") || "article";
}

/**
 * Existing slugs, read from the artifacts themselves (authoritative — the
 * filename is only a storage/ordering detail).
 */
async function existingSlugs(dir: string): Promise<Set<string>> {
  // Seeded with the reserved route segments: `/insights/explainers` and
  // `/insights/market-updates` are static routes at the same level as article
  // slugs, and a static segment silently wins over `[slug]` — so an article
  // that derived one of those slugs would be permanently unreachable.
  const slugs = new Set<string>(RESERVED_INSIGHT_SLUGS);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return slugs; // nothing generated yet
  }
  for (const file of files) {
    try {
      const parsed = JSON.parse(await readFile(path.join(dir, file), "utf8"));
      if (typeof parsed?.slug === "string") slugs.add(parsed.slug);
    } catch {
      // Unreadable/invalid artifact — the data layer warns about it; ignore here.
    }
  }
  return slugs;
}

/**
 * Dropping the date prefix means two articles on the same topic can now derive
 * the same slug. That would be a real bug — `getArticleBySlug` takes the first
 * match and `generateStaticParams` would emit a duplicate route — so disambiguate.
 */
function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
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

  // The slug is the public URL and carries NO date: a date prefix pushes the
  // keywords rightwards and permanently dates the URL. The date stays in the
  // *filename* only, which keeps the directory chronological. This matches the
  // hand-seeded editorial articles.
  const dir = path.join(process.cwd(), "src", "content", "articles");
  const slug = uniqueSlug(kebab(generated.title), await existingSlugs(dir));

  const article: Article = {
    contractVersion: ARTICLE_CONTRACT_VERSION,
    slug,
    title: generated.title,
    description: generated.description,
    category: generated.category,
    kind: generated.kind,
    tags: generated.tags,
    date,
    updatedAt: now.toISOString(),
    origin: "generated",
    status: "draft",
    bodyMarkdown: generated.bodyMarkdown,
    sources: generated.sources,
  };

  const validated = articleSchema.parse(article);

  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${date}-${slug}.json`);
  await writeFile(out, JSON.stringify(validated, null, 2) + "\n", "utf8");

  console.log(`[article] wrote ${out}`);
  console.log(`[article] slug=${slug}`);
  console.log(`[article] title="${validated.title}" category=${validated.category} sources=${validated.sources.length}`);
}

main().catch((err) => {
  console.error("[article] FAILED:", err);
  process.exit(1);
});
