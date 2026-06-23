import { stripHtml } from "@/server/llm/sanitize";

import type { GeneratedOutlook } from "./schema";

export function sanitizeGenerated(g: GeneratedOutlook): GeneratedOutlook {
  return {
    ...g,
    summary: g.summary.trim(),
    analysisMarkdown: stripHtml(g.analysisMarkdown),
    calls: g.calls.map((c) => ({ ...c, reason: c.reason.trim() })),
  };
}
