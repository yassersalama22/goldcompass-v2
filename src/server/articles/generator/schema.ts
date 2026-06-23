import { z } from "zod";

import { sourceSchema } from "@/types/outlook";

/**
 * What the LLM produces for an article. The pipeline adds slug, dates,
 * status, origin, and contractVersion. At least one source is REQUIRED — the
 * whole point of these articles is cited, reputable data.
 */
export const generatedArticleSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(300),
  category: z.string().min(1).max(40),
  tags: z.array(z.string()).max(8),
  bodyMarkdown: z.string().min(1),
  sources: z.array(sourceSchema).min(1).max(12),
});
export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

/** Context fed to the model. Spot price keeps timely pieces grounded. */
export type ArticleGenerationInput = {
  date: string;
  spot: { price: number; changePct24h: number | null; asOf: string } | null;
  /** Optional steer; if omitted the model picks a timely, useful topic. */
  topic?: string;
};
