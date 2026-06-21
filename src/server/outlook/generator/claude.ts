import Anthropic from "@anthropic-ai/sdk";

import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { generatedOutlookSchema, type GeneratedOutlook, type GenerationInput } from "./schema";
import type { OutlookGenerator } from "./provider";

const MODEL = process.env.OUTLOOK_MODEL ?? "claude-opus-4-8";
const MAX_TOKENS = 16000;
const MAX_PAUSE_CONTINUATIONS = 4;
/** Fewer searches = less injected content = lower cost. */
const WEB_SEARCH_MAX_USES = Number(process.env.OUTLOOK_WEB_SEARCH_MAX_USES ?? 4);

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
/** Effort drives thinking depth + token spend. Default `medium` keeps the
 *  daily run inexpensive; raise to `high` for deeper analysis at higher cost. */
const EFFORT: Effort = EFFORTS.includes(process.env.OUTLOOK_EFFORT as Effort)
  ? (process.env.OUTLOOK_EFFORT as Effort)
  : "medium";

const WEB_SEARCH_TOOL = {
  type: "web_search_20260209" as const,
  name: "web_search" as const,
  max_uses: WEB_SEARCH_MAX_USES,
};

/** Concatenate the text blocks of an assistant message. */
function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Pull a JSON object out of a text blob (tolerates stray fences/prose). */
function parseJsonObject(text: string): unknown {
  let s = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Otherwise take the outermost { ... }.
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) s = s.slice(first, last + 1);
  }
  return JSON.parse(s);
}

export function createClaudeGenerator(): OutlookGenerator {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  async function runToCompletion(
    messages: Anthropic.MessageParam[],
    useSearch: boolean,
  ): Promise<Anthropic.Message> {
    const create = () =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        system: SYSTEM_PROMPT,
        messages,
        tools: useSearch ? [WEB_SEARCH_TOOL] : undefined,
      });

    let response = await create();

    // Server-tool loop: resume on pause_turn until the model finishes.
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < MAX_PAUSE_CONTINUATIONS) {
      messages.push({ role: "assistant", content: response.content });
      response = await create();
      continuations++;
    }

    if (response.stop_reason === "refusal") {
      throw new Error("Claude refused the outlook generation request.");
    }
    return response;
  }

  return {
    name: `Claude (${MODEL}, effort=${EFFORT}, search≤${WEB_SEARCH_MAX_USES})`,

    async generate(input: GenerationInput): Promise<GeneratedOutlook> {
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: buildUserPrompt(input) },
      ];

      const response = await runToCompletion(messages, true);
      const text = extractText(response.content);

      try {
        return generatedOutlookSchema.parse(parseJsonObject(text));
      } catch (err) {
        // One corrective retry — feed the bad output back, no search this time.
        const reason = err instanceof Error ? err.message : String(err);
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content:
            `Your previous response was not valid JSON matching the required schema. ` +
            `Error: ${reason}. Respond with ONLY the corrected JSON object — no prose, no code fences.`,
        });
        const retry = await runToCompletion(messages, false);
        return generatedOutlookSchema.parse(parseJsonObject(extractText(retry.content)));
      }
    },
  };
}
