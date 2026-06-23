import type { ArticleGenerator } from "./provider";
import type { ArticleGenerationInput, GeneratedArticle } from "./schema";

/** Deterministic offline generator for testing the pipeline without a key. */
export function createMockArticleGenerator(): ArticleGenerator {
  return {
    name: "Mock (deterministic)",

    async generate(input: ArticleGenerationInput): Promise<GeneratedArticle> {
      const priceLine = input.spot
        ? `Gold trades near $${Math.round(input.spot.price).toLocaleString("en-US")} per ounce.`
        : "Gold prices were not available at generation time.";

      return {
        title: "Gold market: a placeholder pipeline-test article",
        description:
          "Placeholder content generated without live research. Replace with a real run before publishing.",
        category: "News",
        tags: ["gold", "test"],
        bodyMarkdown: [
          "## Overview",
          "",
          `This is mock content used to test the article pipeline offline. ${priceLine}`,
          "",
          "A real generation run uses live web research and cites reputable sources for every claim.",
          "",
          "## Why this exists",
          "",
          "- Verifies the fetch → generate → validate → write-draft flow",
          "- Exercises Markdown rendering and the sources list",
          "",
          "Do not publish mock articles.",
        ].join("\n"),
        sources: [
          { title: "World Gold Council", url: "https://www.gold.org/" },
        ],
      };
    },
  };
}
