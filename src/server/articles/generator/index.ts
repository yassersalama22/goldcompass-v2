import { createMockArticleGenerator } from "./mock";
import type { ArticleGenerator } from "./provider";

export { ARTICLE_PROMPT_VERSION } from "./prompt";
export { sanitizeGeneratedArticle } from "./sanitize";
export { generatedArticleSchema } from "./schema";
export type { ArticleGenerationInput, GeneratedArticle } from "./schema";
export type { ArticleGenerator } from "./provider";

/**
 * Select the article generator. Claude when ANTHROPIC_API_KEY is set (and not
 * forced to mock), otherwise the deterministic mock. Claude module is imported
 * lazily so the SDK isn't required for the mock path.
 */
export async function getArticleGenerator(): Promise<ArticleGenerator> {
  const useMock =
    process.env.ARTICLE_GENERATOR === "mock" || !process.env.ANTHROPIC_API_KEY;
  if (useMock) return createMockArticleGenerator();
  const { createClaudeArticleGenerator } = await import("./claude");
  return createClaudeArticleGenerator();
}
