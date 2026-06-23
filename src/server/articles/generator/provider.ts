import type { ArticleGenerationInput, GeneratedArticle } from "./schema";

/** Article generation provider abstraction (mirrors the outlook generator). */
export interface ArticleGenerator {
  readonly name: string;
  generate(input: ArticleGenerationInput): Promise<GeneratedArticle>;
}
