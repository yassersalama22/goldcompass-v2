import { stripHtml } from "@/server/llm/sanitize";

import type { GeneratedArticle } from "./schema";

export function sanitizeGeneratedArticle(a: GeneratedArticle): GeneratedArticle {
  return {
    ...a,
    title: a.title.trim(),
    description: a.description.trim(),
    category: a.category.trim(),
    tags: a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    bodyMarkdown: stripHtml(a.bodyMarkdown),
  };
}
