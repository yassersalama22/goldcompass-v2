/**
 * Generate the gold outlook draft (Aureus v2 pipeline).
 *
 *   1. Fetch authoritative price data (CoinGecko).
 *   2. Generate the analysis via the configured provider (Claude, or the mock
 *      when ANTHROPIC_API_KEY is unset / OUTLOOK_GENERATOR=mock).
 *   3. Sanitize + assemble a full OutlookReport (origin: generated, status: draft).
 *   4. Validate against the contract and write src/content/outlook/draft.json.
 *
 * Does NOT publish. Run `publish-outlook` (or merge the PR) to go live.
 *   npm run outlook:generate
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { coinGeckoProvider } from "@/server/price/coingecko";
import {
  getOutlookGenerator,
  sanitizeGenerated,
  PROMPT_VERSION,
  type GenerationInput,
} from "@/server/outlook/generator";
import {
  CONTRACT_VERSION,
  outlookReportSchema,
  shortTermCall,
  longTermCall,
  type OutlookReport,
} from "@/types/outlook";

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function buildSeries(): Promise<GenerationInput["series"]> {
  try {
    const { points } = await coinGeckoProvider.getSeries30d();
    if (points.length < 2) return null;
    const start = points[0];
    const end = points[points.length - 1];
    const prices = points.map((p) => p.price);
    return {
      start: { date: isoDate(start.t), price: start.price },
      end: { date: isoDate(end.t), price: end.price },
      min: Math.min(...prices),
      max: Math.max(...prices),
      changePct30d: ((end.price - start.price) / start.price) * 100,
    };
  } catch (err) {
    console.warn("[generate] series unavailable:", (err as Error).message);
    return null;
  }
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const quote = await coinGeckoProvider.getQuote();
  const series = await buildSeries();

  const generator = await getOutlookGenerator();
  console.log(`[generate] provider=${generator.name} prompt=${PROMPT_VERSION} date=${date}`);

  const generated = sanitizeGenerated(
    await generator.generate({
      date,
      spot: { price: quote.price, changePct24h: quote.changePct24h, asOf: quote.asOf },
      series,
    }),
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
    calls: generated.calls,
    keyLevels: generated.keyLevels,
    analysisMarkdown: generated.analysisMarkdown,
    sources: generated.sources,
  };

  const validated = outlookReportSchema.parse(report);

  const dir = path.join(process.cwd(), "src", "content", "outlook");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "draft.json");
  await writeFile(out, JSON.stringify(validated, null, 2) + "\n", "utf8");

  console.log(`[generate] wrote ${out}`);
  console.log(
    `[generate] short=${shortTermCall(validated)?.signal} long=${longTermCall(validated)?.signal}`,
  );
}

main().catch((err) => {
  console.error("[generate] FAILED:", err);
  process.exit(1);
});
