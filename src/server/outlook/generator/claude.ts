import {
  generateGroundedJson,
  parseEffort,
  type Effort,
} from "@/server/llm/grounded-json";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { generatedOutlookSchema, type GeneratedOutlook, type GenerationInput } from "./schema";
import type { OutlookGenerator } from "./provider";

const MODEL = process.env.OUTLOOK_MODEL ?? "claude-opus-4-8";
const EFFORT: Effort = parseEffort(process.env.OUTLOOK_EFFORT, "medium");
const WEB_SEARCH_MAX_USES = Number(process.env.OUTLOOK_WEB_SEARCH_MAX_USES ?? 4);

export function createClaudeGenerator(): OutlookGenerator {
  return {
    name: `Claude (${MODEL}, effort=${EFFORT}, search≤${WEB_SEARCH_MAX_USES})`,

    generate(input: GenerationInput): Promise<GeneratedOutlook> {
      return generateGroundedJson(
        SYSTEM_PROMPT,
        buildUserPrompt(input),
        generatedOutlookSchema,
        { model: MODEL, effort: EFFORT, webSearchMaxUses: WEB_SEARCH_MAX_USES },
      );
    },
  };
}
