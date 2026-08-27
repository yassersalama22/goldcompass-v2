import { z } from "zod";

import { sourceSchema } from "@/types/outlook";
import { translationMetaSchema } from "@/types/translation";

/**
 * Article contract — the single source of truth for the articles/insights
 * content system. Like the outlook contract: zod is authoritative, the
 * generated artifact IS this shape, and both the web + `/api/v1/articles`
 * read it through the data-access layer. Sources are reused from the outlook
 * contract (a source is a source).
 */
export const ARTICLE_CONTRACT_VERSION = 1;

/**
 * How long a piece stays true — deliberately orthogonal to `category`.
 *
 * Category describes the subject ("Central Banks"); kind describes the reader's
 * freshness expectation. They cross: "Why central banks keep buying gold" is an
 * explainer and "Fed holds rates again" is a market update, and both are
 * Central Banks. Deriving one from the other would mis-file both.
 *
 * Added after `ARTICLE_CONTRACT_VERSION = 1` shipped. The version is unchanged
 * on purpose: adding a field is backwards-compatible for `/api/v1/articles`
 * consumers, which ignore keys they don't know. Bumping would break them for no
 * gain.
 */
export const articleKindSchema = z.enum(["explainer", "market-update"]);
export type ArticleKind = z.infer<typeof articleKindSchema>;

export const articleSchema = z.object({
  contractVersion: z.literal(ARTICLE_CONTRACT_VERSION),
  /** URL slug (kebab-case, unique). */
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  title: z.string().min(1).max(140),
  /** Meta description + card excerpt. */
  description: z.string().min(1).max(300),
  /** Primary category, e.g. "Central Banks", "Market Analysis", "Education". */
  category: z.string().min(1),
  /** Durability of the piece — drives the /insights sub-views. */
  kind: articleKindSchema,
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
  /**
   * Language of this artifact. Optional so the pre-i18n English artifacts stay
   * valid without a migration; absent means the canonical locale.
   */
  locale: z.string().min(1).optional(),
  /** Present only on translated artifacts. See `types/translation.ts`. */
  translation: translationMetaSchema.optional(),
});
export type Article = z.infer<typeof articleSchema>;

/** List/card/API shape — omits the heavy body. */
export type ArticleSummary = Omit<Article, "bodyMarkdown">;

export function toArticleSummary(a: Article): ArticleSummary {
  const { bodyMarkdown: _body, ...summary } = a;
  void _body;
  return summary;
}
