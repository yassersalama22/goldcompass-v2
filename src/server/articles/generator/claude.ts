import {
  generateGroundedJson,
  parseEffort,
  type Effort,
} from "@/server/llm/grounded-json";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import {
  generatedArticleSchema,
  type ArticleGenerationInput,
  type GeneratedArticle,
} from "./schema";
import type { ArticleGenerator } from "./provider";

const MODEL = process.env.ARTICLE_MODEL ?? "claude-opus-4-8";
const EFFORT: Effort = parseEffort(process.env.ARTICLE_EFFORT, "medium");
const WEB_SEARCH_MAX_USES = Number(process.env.ARTICLE_WEB_SEARCH_MAX_USES ?? 5);

export function createClaudeArticleGenerator(): ArticleGenerator {
  return {
    name: `Claude (${MODEL}, effort=${EFFORT}, search≤${WEB_SEARCH_MAX_USES})`,

    generate(input: ArticleGenerationInput): Promise<GeneratedArticle> {
      return generateGroundedJson(
        SYSTEM_PROMPT,
        buildUserPrompt(input),
        generatedArticleSchema,
        { model: MODEL, effort: EFFORT, webSearchMaxUses: WEB_SEARCH_MAX_USES },
      );
    },
  };
}
