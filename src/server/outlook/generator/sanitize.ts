import { stripHtml } from "@/server/llm/sanitize";

import type { GeneratedOutlook } from "./schema";

/**
 * Every string the model wrote, with HTML-shaped sequences removed. The page
 * renders these as text or through react-markdown, so nothing here would
 * execute — this keeps stored artifacts plain so that stays true wherever they
 * are rendered next (§12: store Markdown, never model HTML).
 */
export function sanitizeGenerated(g: GeneratedOutlook): GeneratedOutlook {
  return {
    ...g,
    summary: stripHtml(g.summary),
    analysisMarkdown: stripHtml(g.analysisMarkdown),
    drivers: g.drivers.map((d) => ({
      ...d,
      title: stripHtml(d.title),
      summary: stripHtml(d.summary),
    })),
    adjustments: {
      short: { ...g.adjustments.short, reason: stripHtml(g.adjustments.short.reason ?? "") },
      long: { ...g.adjustments.long, reason: stripHtml(g.adjustments.long.reason ?? "") },
    },
    calls: g.calls.map((c) => ({
      ...c,
      reason: stripHtml(c.reason),
      invalidation: stripHtml(c.invalidation),
    })),
  };
}
