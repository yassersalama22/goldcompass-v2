import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

import { extractText, parseJsonObject } from "./json";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export function parseEffort(value: string | undefined, fallback: Effort): Effort {
  return EFFORTS.includes(value as Effort) ? (value as Effort) : fallback;
}

export type GroundedJsonOptions = {
  model: string;
  effort: Effort;
  webSearchMaxUses: number;
  maxTokens?: number;
};

const MAX_PAUSE_CONTINUATIONS = 4;

/**
 * Run a single web-search-grounded Claude request that must return one JSON
 * object, validate it against `schema`, and retry once (no search) with the
 * error fed back if validation fails. Shared by the outlook + article
 * generators so the SDK/tool/loop logic lives in one place.
 */
export async function generateGroundedJson<T>(
  system: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  opts: GroundedJsonOptions,
): Promise<T> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const webSearchTool = {
    type: "web_search_20260209" as const,
    name: "web_search" as const,
    max_uses: opts.webSearchMaxUses,
  };

  async function runToCompletion(
    messages: Anthropic.MessageParam[],
    useSearch: boolean,
  ): Promise<Anthropic.Message> {
    const create = () =>
      client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort },
        system,
        messages,
        tools: useSearch ? [webSearchTool] : undefined,
      });

    let response = await create();
    let continuations = 0;
    while (
      response.stop_reason === "pause_turn" &&
      continuations < MAX_PAUSE_CONTINUATIONS
    ) {
      messages.push({ role: "assistant", content: response.content });
      response = await create();
      continuations++;
    }
    if (response.stop_reason === "refusal") {
      throw new Error("Claude refused the generation request.");
    }
    return response;
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  const response = await runToCompletion(messages, true);

  try {
    return schema.parse(parseJsonObject(extractText(response.content)));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content:
        `Your previous response was not valid JSON matching the required schema. ` +
        `Error: ${reason}. Respond with ONLY the corrected JSON object — no prose, no code fences.`,
    });
    const retry = await runToCompletion(messages, false);
    return schema.parse(parseJsonObject(extractText(retry.content)));
  }
}
