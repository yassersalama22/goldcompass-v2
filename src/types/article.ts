import { z } from "zod";

import { sourceSchema } from "@/types/outlook";

/**
 * Article contract — the single source of truth for the articles/insights
 * content system. Like the outlook contract: zod is authoritative, the
 * generated artifact IS this shape, and both the web + `/api/v1/articles`
 * read it through the data-access layer. Sources are reused from the outlook
 * contract (a source is a source).
 */
export const ARTICLE_CONTRACT_VERSION = 1;

export const articleSchema = z.object({
  contractVersion: z.literal(ARTICLE_CONTRACT_VERSION),
  /** URL slug (kebab-case, unique). */
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  title: z.string().min(1).max(140),
  /** Meta description + card excerpt. */
  description: z.string().min(1).max(300),
  /** Primary category, e.g. "Central Banks", "Market Analysis", "Education". */
  category: z.string().min(1),
  tags: z.array(z.string()).max(8),
  /** ISO date the article was published. */
  date: z.string(),
  /** ISO timestamp of the last update. */
  updatedAt: z.string(),
  origin: z.enum(["editorial", "generated"]),
  status: z.enum(["draft", "published"]),
  /** Full body as Markdown (rendered safely; never raw HTML). */
  bodyMarkdown: z.string().min(1),
  /** Sources the article draws its data/claims from — always cited. */
  sources: z.array(sourceSchema),
});
export type Article = z.infer<typeof articleSchema>;

/** List/card/API shape — omits the heavy body. */
export type ArticleSummary = Omit<Article, "bodyMarkdown">;

export function toArticleSummary(a: Article): ArticleSummary {
  const { bodyMarkdown: _body, ...summary } = a;
  void _body;
  return summary;
}
