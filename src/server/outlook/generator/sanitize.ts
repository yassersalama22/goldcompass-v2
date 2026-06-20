import type { GeneratedOutlook } from "./schema";

/**
 * Defense-in-depth: the analysis is rendered with react-markdown (which already
 * does NOT execute raw HTML), but we still strip HTML-like tags from
 * model/grounded output so the stored artifact is plain Markdown. This removes
 * the indirect prompt-injection → stored-HTML vector the old engine had.
 *
 * Note: `<` followed by a space (e.g. "a < b") is preserved; only tag-shaped
 * `<tag ...>` / `</tag>` sequences are removed.
 */
function stripHtml(markdown: string): string {
  return markdown
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .trim();
}

export function sanitizeGenerated(g: GeneratedOutlook): GeneratedOutlook {
  return {
    ...g,
    summary: g.summary.trim(),
    analysisMarkdown: stripHtml(g.analysisMarkdown),
    calls: g.calls.map((c) => ({ ...c, reason: c.reason.trim() })),
  };
}
