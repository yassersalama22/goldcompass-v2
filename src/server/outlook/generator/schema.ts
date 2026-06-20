import { z } from "zod";

import {
  keyLevelSchema,
  outlookCallSchema,
  sourceSchema,
} from "@/types/outlook";

/**
 * What the LLM produces. A subset of `OutlookReport` — the deterministic fields
 * (spot price, dates, contractVersion, origin, status) are added by the
 * pipeline, NOT the model. The model only does analysis on top of ground-truth
 * data it is given.
 */
export const generatedOutlookSchema = z.object({
  summary: z.string().min(1).max(600),
  calls: z.array(outlookCallSchema).min(1).max(2),
  keyLevels: z.array(keyLevelSchema).max(8),
  analysisMarkdown: z.string().min(1),
  sources: z.array(sourceSchema).max(12),
});
export type GeneratedOutlook = z.infer<typeof generatedOutlookSchema>;

/** Deterministic market data fed to the model as authoritative ground truth. */
export type GenerationInput = {
  /** ISO date the outlook is for. */
  date: string;
  spot: {
    price: number;
    changePct24h: number | null;
    asOf: string;
  };
  /** Compact 30-day series summary (so the model doesn't invent the trend). */
  series: {
    start: { date: string; price: number };
    end: { date: string; price: number };
    min: number;
    max: number;
    changePct30d: number;
  } | null;
};
