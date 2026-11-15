import {
  generateGroundedJson,
  parseEffort,
  type Effort,
} from "@/server/llm/grounded-json";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import {
  advisoriesFor,
  buildGeneratedSchema,
  type GeneratedOutlook,
  type GenerationInput,
} from "./schema";
import type { OutlookGenerator } from "./provider";

const MODEL = process.env.OUTLOOK_MODEL ?? "claude-opus-4-8";
const EFFORT: Effort = parseEffort(process.env.OUTLOOK_EFFORT, "medium");
// Six, up from four: research is now the model's main job — it has to find and
// date the events behind the market, not just colour in a narrative.
const WEB_SEARCH_MAX_USES = Number(process.env.OUTLOOK_WEB_SEARCH_MAX_USES ?? 6);

export function createClaudeGenerator(): OutlookGenerator {
  return {
    name: `Claude (${MODEL}, effort=${EFFORT}, search≤${WEB_SEARCH_MAX_USES})`,

    generate(input: GenerationInput): Promise<GeneratedOutlook> {
      return generateGroundedJson(
        SYSTEM_PROMPT,
        buildUserPrompt(input),
        // Built per run: it carries today's scorecard, levels and permitted
        // adjustments, so a response that contradicts them fails validation
        // and gets the one corrective retry.
        buildGeneratedSchema(input),
        { model: MODEL, effort: EFFORT, webSearchMaxUses: WEB_SEARCH_MAX_USES },
        // Prose judgements (advice framing, a possible "record" claim) get one
        // revision pass and are then left to the reviewer — never a failed run.
        (generated) => advisoriesFor(generated, input),
      );
    },
  };
}
